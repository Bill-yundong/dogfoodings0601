import threading
import time
from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple

import models
from config import DEADLOCK_DETECT_INTERVAL, LOCK_TIMEOUT
from logger import get_logger


class DeadlockDetector:
    def __init__(self, rollback_queues: Dict[int, "multiprocessing.Queue"]):
        self.rollback_queues = rollback_queues
        self.logger = get_logger("DeadlockDetector")
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._detection_count = 0
        self._deadlock_count = 0
        self._cleanup_count = 0
        self._rollback_counts: Dict[int, int] = defaultdict(int)

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._detection_loop,
            name="DeadlockDetector",
            daemon=True,
        )
        self._thread.start()
        self.logger.info("Deadlock detector started")

    def stop(self):
        if self._thread and self._thread.is_alive():
            self._stop_event.set()
            self._thread.join(timeout=5.0)
            self.logger.info(
                f"Deadlock detector stopped. Scans={self._detection_count}, "
                f"Deadlocks found={self._deadlock_count}, "
                f"Expired locks cleaned={self._cleanup_count}"
            )

    def _detection_loop(self):
        while not self._stop_event.is_set():
            try:
                self._detection_count += 1
                self.logger.debug(
                    f"Running deadlock detection scan #{self._detection_count}"
                )
                self._cleanup_expired_locks()
                self._run_detection()
            except Exception as e:
                self.logger.error(f"Deadlock detection error: {e}", exc_info=True)
            self._stop_event.wait(DEADLOCK_DETECT_INTERVAL)

    def _cleanup_expired_locks(self):
        expired = models.cleanup_expired_locks(LOCK_TIMEOUT)
        if expired:
            self._cleanup_count += len(expired)
            for e in expired:
                self.logger.warning(
                    f"HEARTBEAT TIMEOUT: Cleaned up expired lock '{e['lock_name']}' "
                    f"from {e['holder_name']} (pid={e['holder_pid']}) - "
                    f"process may have died"
                )

    def _build_wait_for_graph(self) -> Dict[int, Set[Tuple[int, str]]]:
        """构建等待图: waiter_pid -> set of (holder_pid, lock_name)"""
        graph = defaultdict(set)
        waiting = models.get_waiting_processes()

        for w in waiting:
            waiter = w["waiter_pid"]
            holder = w["holder_pid"]
            lock_name = w["lock_name"]
            if waiter != holder:
                graph[waiter].add((holder, lock_name))

        return graph

    def _find_cycles(
        self, graph: Dict[int, Set[Tuple[int, str]]]
    ) -> List[List[Tuple[int, str]]]:
        """使用 DFS 检测等待图中的所有环路"""
        cycles = []
        visited = set()
        rec_stack = {}
        path = []

        def dfs(node: int):
            if node in rec_stack:
                cycle_start = rec_stack[node]
                cycle = path[cycle_start:] + [(node, "→ cycle")]
                cycles.append(cycle)
                return

            if node in visited:
                return

            visited.add(node)
            rec_stack[node] = len(path)

            for neighbor, lock_name in graph.get(node, set()):
                path.append((node, lock_name))
                dfs(neighbor)
                path.pop()

            del rec_stack[node]

        for node in list(graph.keys()):
            if node not in visited:
                dfs(node)

        return cycles

    def _select_victim(
        self, cycle: List[Tuple[int, str]], lock_info_map: Dict[int, dict]
    ) -> Tuple[int, str]:
        """防饿死选牺牲者：优先选历史回滚次数最少的，其次选优先级最低的，最后选持锁最少的"""
        candidates = []
        for pid, _ in cycle[:-1]:
            info = lock_info_map.get(pid, {"priority": 0, "lock_count": 0})
            rb_count = self._rollback_counts.get(pid, 0)
            candidates.append(
                (
                    pid,
                    info.get("holder_name", f"Process-{pid}"),
                    info.get("priority", 0),
                    info.get("lock_count", 0),
                    rb_count,
                )
            )

        candidates.sort(key=lambda x: (x[4], x[2], x[3]))
        victim_pid, victim_name, victim_prio, _, victim_rb = candidates[0]
        self.logger.info(
            f"Victim selected: {victim_name} (pid={victim_pid}, "
            f"priority={victim_prio}, past_rollbacks={victim_rb})"
        )
        return victim_pid, victim_name

    def _rollback_victim(self, victim_pid: int, victim_name: str) -> str:
        """强制回滚牺牲者进程"""
        self._rollback_counts[victim_pid] += 1
        self.logger.warning(
            f"DEADLOCK RESOLUTION: Rolling back {victim_name} (pid={victim_pid}, "
            f"cumulative rollbacks={self._rollback_counts[victim_pid]})"
        )

        try:
            if victim_pid in self.rollback_queues:
                self.rollback_queues[victim_pid].put("ROLLBACK")
                self.logger.info(
                    f"Sent rollback signal to {victim_name} (pid={victim_pid})"
                )
                result = "rollback_signal_sent"
            else:
                self.logger.warning(
                    f"No rollback queue for {victim_name} (pid={victim_pid}), "
                    f"performing force cleanup"
                )
                removed = models.release_all_locks_by_pid(victim_pid)
                result = f"force_cleanup_removed_{removed}_locks"
        except Exception as e:
            self.logger.error(f"Rollback error for {victim_name}: {e}")
            result = f"error: {str(e)}"

        return result

    def _run_detection(self):
        graph = self._build_wait_for_graph()

        if not graph:
            self.logger.debug("No waiting processes, skip detection")
            return

        cycles = self._find_cycles(graph)

        if not cycles:
            self.logger.debug("No deadlock cycles detected")
            return

        self._deadlock_count += len(cycles)

        all_locks = models.get_all_locks()
        lock_info_map: Dict[int, dict] = {}
        for lock in all_locks:
            pid = lock["holder_pid"]
            if pid not in lock_info_map:
                lock_info_map[pid] = {
                    "holder_name": lock["holder_name"],
                    "priority": lock["priority"],
                    "lock_count": 0,
                }
            lock_info_map[pid]["lock_count"] += 1

        for i, cycle in enumerate(cycles):
            cycle_str = " → ".join(
                [f"{pid}({lock})" for pid, lock in cycle]
            )
            self.logger.warning(
                f"DEADLOCK DETECTED cycle #{i + 1}: {cycle_str}"
            )

            victim_pid, victim_name = self._select_victim(cycle, lock_info_map)
            result = self._rollback_victim(victim_pid, victim_name)

            models.log_deadlock(cycle_str, victim_pid, victim_name, result)

            self.logger.info(
                f"Deadlock cycle #{i + 1} resolved. Victim: {victim_name} "
                f"(pid={victim_pid}), Result: {result}"
            )

    def get_stats(self) -> dict:
        return {
            "detection_count": self._detection_count,
            "deadlock_count": self._deadlock_count,
            "cleanup_count": self._cleanup_count,
            "rollback_counts": dict(self._rollback_counts),
        }
