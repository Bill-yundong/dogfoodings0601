import { Component, createEffect, createSignal, onMount } from 'solid-js';
import { Bell, Moon, Sun, Search, Wifi, WifiOff, Database, Activity } from 'lucide-solid';
import { formatTimestamp } from '@/utils/time';
import { configStore, configActions } from '@/stores/config';
import { realtimeStore } from '@/stores/realtime';
import { cn } from '@/lib/utils';

export const Header: Component = () => {
  const [currentTime, setCurrentTime] = createSignal(new Date());
  const [searchOpen, setSearchOpen] = createSignal(false);

  onMount(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  });

  createEffect(() => {
    configActions.loadConfig();
  });

  const isRecording = () => realtimeStore.isRecording;
  const dataPointCount = () =>
    realtimeStore.envData.length + realtimeStore.sleepData.length;

  return (
    <header class="h-16 bg-midnight-900/60 backdrop-blur-xl border-b border-midnight-700/50 flex items-center justify-between px-6">
      <div class="flex items-center gap-4">
        <div class="relative">
          <div
            class={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300',
              searchOpen()
                ? 'bg-midnight-800/80 w-72'
                : 'bg-midnight-800/40 hover:bg-midnight-800/60 w-48'
            )}
          >
            <Search class="w-4 h-4 text-midnight-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="搜索会话、设备..."
              class="bg-transparent border-none outline-none text-sm text-white placeholder-midnight-400 w-full"
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
            />
          </div>
        </div>

        <div class="hidden md:flex items-center gap-2 px-3 py-1.5 bg-midnight-800/40 rounded-xl">
          <div class={cn(
            'w-2 h-2 rounded-full',
            isRecording() ? 'bg-mint-400 animate-pulse' : 'bg-midnight-500'
          )} />
          <span class={cn(
            'text-xs font-medium',
            isRecording() ? 'text-mint-400' : 'text-midnight-400'
          )}>
            {isRecording() ? '记录中' : '待机'}
          </span>
          {isRecording() && (
            <span class="text-xs text-midnight-400 ml-2">
              {dataPointCount()} 数据点
            </span>
          )}
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div class="hidden lg:flex items-center gap-6 mr-4">
          <div class="flex items-center gap-2">
            <Activity class="w-4 h-4 text-moon-400" />
            <span class="text-sm text-midnight-300 font-mono">
              {formatTimestamp(currentTime().getTime(), 'HH:mm:ss')}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Database class="w-4 h-4 text-mint-400" />
            <span class="text-sm text-midnight-300">
              {realtimeStore.alignedData.length} 已对齐
            </span>
          </div>
          <div class="flex items-center gap-2">
            {realtimeStore.isConnected ? (
              <Wifi class="w-4 h-4 text-mint-400" />
            ) : (
              <WifiOff class="w-4 h-4 text-amber-400" />
            )}
            <span class={cn(
              'text-sm',
              realtimeStore.isConnected ? 'text-mint-400' : 'text-amber-400'
            )}>
              {realtimeStore.isConnected ? '已连接' : '断开'}
            </span>
          </div>
        </div>

        <button
          onClick={() => configActions.toggleTheme()}
          class="p-2.5 rounded-xl bg-midnight-800/40 hover:bg-midnight-800/60 transition-all hover:scale-105"
        >
          {configStore.config.theme === 'dark' ? (
            <Sun class="w-4 h-4 text-amber-400" />
          ) : (
            <Moon class="w-4 h-4 text-moon-400" />
          )}
        </button>

        <button class="p-2.5 rounded-xl bg-midnight-800/40 hover:bg-midnight-800/60 transition-all hover:scale-105 relative">
          <Bell class="w-4 h-4 text-midnight-300" />
          <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full" />
        </button>

        <div class="flex items-center gap-3 pl-3 border-l border-midnight-700/50">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-moon-500 to-mint-500 flex items-center justify-center text-white font-bold text-sm">
            U
          </div>
          <div class="hidden sm:block">
            <p class="text-sm font-medium text-white">用户</p>
            <p class="text-xs text-midnight-400">高级版</p>
          </div>
        </div>
      </div>
    </header>
  );
};
