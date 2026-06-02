import { Component, createEffect, onMount, onCleanup } from 'solid-js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface LineChartProps {
  data: { x: number | string; y: number }[];
  label?: string;
  color?: string;
  height?: number;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export const LineChart: Component<LineChartProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;
  let chart: Chart | null = null;

  const color = props.color || '#00D4FF';

  onMount(() => {
    if (!canvasRef) return;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: props.data.map(d => d.x),
        datasets: [{
          label: props.label || '数据',
          data: props.data.map(d => d.y),
          borderColor: color,
          backgroundColor: `${color}33`,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            display: !!props.xAxisLabel,
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.5)',
              font: { family: 'JetBrains Mono', size: 10 },
            },
          },
          y: {
            display: !!props.yAxisLabel,
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.5)',
              font: { family: 'JetBrains Mono', size: 10 },
            },
          },
        },
      },
    });
  });

  createEffect(() => {
    if (chart && props.data.length > 0) {
      chart.data.labels = props.data.map(d => d.x);
      chart.data.datasets[0].data = props.data.map(d => d.y);
      chart.update('none');
    }
  });

  onCleanup(() => {
    if (chart) {
      chart.destroy();
    }
  });

  return (
    <div style={{ height: `${props.height || 200}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
};
