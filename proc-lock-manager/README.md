# 多进程分布式锁管理与死锁探测系统

基于 Python + SQLite + multiprocessing 构建的多进程分布式锁管理系统，支持死锁检测与自动恢复。

## 功能特性

### 锁管理器 (LockManager)
- **SQLite 存储**：使用 SQLite 作为锁表存储，支持多进程并发访问
- **加锁超时**：支持设置锁获取超时时间，避免无限等待
- **可重入计数**：同一进程可重复获取同一把锁，通过引用计数管理
- **自动续期**：后台心跳线程定期更新锁的 last_heartbeat 时间戳
- **异常退出保护**：心跳超时机制自动释放进程异常退出后残留的锁

### 死锁探测 (DeadlockDetector)
- **等待图扫描**：定期构建 wait-for graph 描述进程间的等待关系
- **环路检测**：DFS 算法检测图中的环路，识别死锁
- **牺牲者选择**：按优先级（低优先级先牺牲）和持锁数量选择回滚进程
- **强制回滚**：向牺牲者进程发送回滚信号，释放其持有的所有锁

### 日志系统
- **多进程安全**：使用 QueueHandler + QueueListener 实现跨进程日志收集
- **完整日志流**：清晰展示加锁、释放、死锁检测、牺牲回滚的全过程

## 项目结构

```
proc-lock-manager/
├── config.py              # 配置参数（超时、间隔等）
├── logger.py              # 多进程安全日志系统
├── models.py              # SQLite 数据模型与数据库操作
├── lock_manager.py        # 核心锁管理器
├── deadlock_detector.py   # 死锁探测模块
├── worker.py              # 工作进程逻辑
├── simulate.py            # 模拟脚本（主入口）
├── requirements.txt       # 依赖列表
└── README.md              # 项目文档
```

## 快速开始

### 运行模拟

```bash
# 启动 8 个进程抢 5 把锁，执行 50 个任务
python simulate.py --workers 8 --tasks 50

# 自定义参数
python simulate.py --workers 4 --tasks 20 --locks 3 --seed 42
```

### 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--workers` | int | 8 | 工作进程数量 |
| `--tasks` | int | 50 | 总任务数量 |
| `--locks` | int | 5 | 可用锁资源数量 |
| `--seed` | int | None | 随机种子，用于复现实验 |

## 核心实现原理

### 数据库表结构

**locks 表**：存储当前持有的锁信息
- `lock_name`: 锁名称（主键）
- `holder_pid`: 持有者进程 ID
- `holder_name`: 持有者进程名称
- `reentrant_count`: 可重入计数
- `acquired_at`: 获取时间
- `last_heartbeat`: 最后心跳时间
- `priority`: 进程优先级

**wait_queue 表**：等待队列
- `lock_name`: 等待的锁名称
- `waiter_pid`: 等待者进程 ID
- `priority`: 等待者优先级
- `requested_at`: 请求时间

**deadlock_log 表**：死锁事件日志
- `detected_at`: 检测时间
- `cycle`: 死锁环路描述
- `victim_pid`: 牺牲者进程 ID
- `rollback_result`: 回滚结果

### 死锁检测算法

1. **构建等待图**：查询 `wait_queue` 表，构建 `waiter -> holder` 的有向边
2. **DFS 环路检测**：遍历图中所有节点，使用递归栈检测环路
3. **牺牲者选择**：
   - 优先级最低的进程先被回滚
   - 优先级相同时，持有锁数量最少的先回滚
4. **回滚执行**：
   - 通过进程间队列发送 `ROLLBACK` 信号
   - 目标进程收到信号后释放所有锁
   - 若进程无响应，直接从数据库强制清理

## 配置调优

可在 [config.py](file:///Users/yundongsoftware/Documents/projects/dogfoodings0601/proc-lock-manager/config.py) 中调整以下参数：

```python
LOCK_TIMEOUT = 5.0           # 锁超时时间（秒）
HEARTBEAT_INTERVAL = 2.0     # 心跳间隔（秒）
DEADLOCK_DETECT_INTERVAL = 3.0  # 死锁检测间隔（秒）
WAIT_TIMEOUT = 10.0          # 锁获取等待超时（秒）
```

## 依赖要求

- Python >= 3.8
- 无需额外第三方库，使用标准库即可运行
  - `sqlite3`: 数据存储
  - `multiprocessing`: 多进程管理
  - `threading`: 心跳与死锁检测线程
  - `logging`: 日志系统

## 日志示例

运行后将看到类似以下的日志流：

```
2024-01-15 10:30:00,123 | MainProcess | INFO    | Starting lock manager simulation: workers=8, tasks=50, locks=5
2024-01-15 10:30:00,124 | Worker-0    | INFO    | [Worker-0] Started (pid=12345, priority=8)
2024-01-15 10:30:00,234 | Worker-0    | INFO    | [Worker-0] Starting task 0, need 2 lock(s)
2024-01-15 10:30:00,235 | Worker-0    | INFO    | [Worker-0] ACQUIRED lock 'resource_0' (reentrant_count=1)
2024-01-15 10:30:00,345 | Worker-1    | INFO    | [Worker-1] ACQUIRED lock 'resource_1' (reentrant_count=1)
...
2024-01-15 10:30:03,567 | MainProcess | WARNING | DEADLOCK DETECTED cycle #1: 12345(resource_0) → 12346(resource_1) → 12345(→ cycle)
2024-01-15 10:30:03,568 | MainProcess | WARNING | DEADLOCK RESOLUTION: Rolling back Worker-1 (pid=12346)
2024-01-15 10:30:03,569 | Worker-1    | WARNING | [Worker-1] Received ROLLBACK signal, releasing all locks
2024-01-15 10:30:03,570 | Worker-1    | INFO    | [Worker-1] RELEASED lock 'resource_1' (fully released)
...
================================================================================
SIMULATION COMPLETE
================================================================================
Total time: 25.34s
Tasks processed: 50/50
  - Success: 45
  - Failed: 0
  - Rollback: 5
```
