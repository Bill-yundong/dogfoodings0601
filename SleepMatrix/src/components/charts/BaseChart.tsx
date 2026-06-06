import { Component, onMount, onCleanup, createEffect, createSignal } from 'solid-js';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';
import { cn } from '@/lib/utils';

interface BaseChartProps {
  option: EChartsOption;
  class?: string;
  height?: string;
  loading?: boolean;
  onChartReady?: (chart: ECharts) => void;
}

export const BaseChart: Component<BaseChartProps> = (props) => {
  let chartRef: HTMLDivElement | undefined;
  const [chart, setChart] = createSignal<ECharts | null>(null);

  onMount(() => {
    if (!chartRef) return;

    const instance = echarts.init(chartRef, 'dark', {
      renderer: 'canvas',
    });

    instance.setOption(props.option);
    setChart(instance);

    props.onChartReady?.(instance);

    const handleResize = () => {
      instance.resize();
    };
    window.addEventListener('resize', handleResize);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      instance.dispose();
    });
  });

  createEffect(() => {
    const instance = chart();
    if (instance) {
      instance.setOption(props.option, {
        notMerge: false,
        lazyUpdate: true,
      });
    }
  });

  createEffect(() => {
    const instance = chart();
    if (instance) {
      if (props.loading) {
        instance.showLoading('default', {
          text: '加载中...',
          color: '#7C3AED',
          textColor: '#94A3B8',
          maskColor: 'rgba(15, 23, 42, 0.8)',
        });
      } else {
        instance.hideLoading();
      }
    }
  });

  return (
    <div
      ref={chartRef}
      class={cn('w-full', props.class)}
      style={{ height: props.height ?? '400px' }}
    />
  );
};
