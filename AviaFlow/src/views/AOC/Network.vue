<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAocStore } from '../../stores/aoc';
import * as echarts from 'echarts';
import VChart from 'vue-echarts';
import type { FlightDuty } from '../../types/schedule';
import { Globe, MapPin, Plane, TrendingUp } from 'lucide-vue-next';
import dayjs from 'dayjs';

const aocStore = useAocStore();

const routeStats = computed(() => {
  const routeMap = new Map<string, { count: number; hours: number; timezoneDiff: number; duties: FlightDuty[] }>();
  
  aocStore.duties.forEach(duty => {
    const key = `${duty.departureAirport.code}-${duty.arrivalAirport.code}`;
    const existing = routeMap.get(key) || { count: 0, hours: 0, timezoneDiff: 0, duties: [] };
    existing.count += 1;
    existing.hours += duty.flightHours;
    existing.timezoneDiff += duty.timezoneDiff;
    existing.duties.push(duty);
    routeMap.set(key, existing);
  });
  
  return Array.from(routeMap.entries())
    .map(([key, data]) => ({
      route: key,
      ...data,
      avgTimezoneDiff: data.timezoneDiff / data.count,
    }))
    .sort((a, b) => b.count - a.count);
});

const airportStats = computed(() => {
  const airportMap = new Map<string, { departures: number; arrivals: number }>();
  
  aocStore.duties.forEach(duty => {
    const dep = airportMap.get(duty.departureAirport.code) || { departures: 0, arrivals: 0 };
    dep.departures += 1;
    airportMap.set(duty.departureAirport.code, dep);
    
    const arr = airportMap.get(duty.arrivalAirport.code) || { departures: 0, arrivals: 0 };
    arr.arrivals += 1;
    airportMap.set(duty.arrivalAirport.code, arr);
  });
  
  return Array.from(airportMap.entries())
    .map(([code, data]) => ({
      code,
      ...data,
      total: data.departures + data.arrivals,
    }))
    .sort((a, b) => b.total - a.total);
});

const networkOption = computed(() => {
  const airports = airportStats.value.slice(0, 15);
  const routes = routeStats.value.slice(0, 20);
  
  const nodes = airports.map(a => ({
    name: a.code,
    value: a.total,
    symbolSize: Math.min(Math.max(a.total * 2, 10), 40),
    category: a.code === 'PEK' || a.code === 'CAN' || a.code === 'SHA' ? 0 : 1,
  }));
  
  const links = routes.map(r => {
    const [from, to] = r.route.split('-');
    return {
      source: from,
      target: to,
      value: r.count,
      lineStyle: {
        width: Math.min(Math.max(r.count * 0.5, 1), 5),
        color: r.avgTimezoneDiff > 4 ? '#ef4444' : r.avgTimezoneDiff > 2 ? '#f97316' : '#22c55e',
        opacity: 0.6,
        curveness: 0.2,
      },
    };
  }).filter(l => 
    nodes.some(n => n.name === l.source) && nodes.some(n => n.name === l.target)
  );
  
  return {
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      borderWidth: 1,
      textStyle: { color: '#e2e8f0' },
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const airport = airportStats.value.find(a => a.code === params.name);
          return `<div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
            <div>起降架次: ${airport?.total || 0}</div>
            <div>出港: ${airport?.departures || 0}</div>
            <div>进港: ${airport?.arrivals || 0}</div>`;
        } else {
          const route = routeStats.value.find(r => r.route === `${params.data.source}-${params.data.target}`);
          return `<div style="font-weight: 600; margin-bottom: 4px;">${params.data.source} → ${params.data.target}</div>
            <div>航班数: ${route?.count || 0}</div>
            <div>累计飞行: ${route?.hours.toFixed(1) || 0}h</div>
            <div>平均时差: ${route?.avgTimezoneDiff.toFixed(1) || 0}h</div>`;
        }
      },
    },
    legend: {
      data: ['枢纽机场', '区域机场'],
      textStyle: { color: '#94a3b8' },
      top: 10,
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        label: {
          show: true,
          position: 'right',
          color: '#e2e8f0',
          fontSize: 11,
        },
        edgeLabel: {
          show: false,
          formatter: '{c}',
          fontSize: 10,
        },
        draggable: true,
        data: nodes,
        links,
        lineStyle: {
          opacity: 0.5,
          curveness: 0.2,
        },
        force: {
          repulsion: 300,
          edgeLength: [80, 200],
          gravity: 0.1,
        },
        categories: [
          { name: '枢纽机场', itemStyle: { color: '#3b82f6' } },
          { name: '区域机场', itemStyle: { color: '#64748b' } },
        ],
      },
    ],
  };
});

const timezoneDistributionOption = computed(() => {
  const bins = [0, 2, 4, 6, 8, 12];
  const labels = ['0-2h', '2-4h', '4-6h', '6-8h', '8h+'];
  const counts = new Array(5).fill(0);
  
  routeStats.value.forEach(route => {
    const avg = route.avgTimezoneDiff;
    if (avg < 2) counts[0]++;
    else if (avg < 4) counts[1]++;
    else if (avg < 6) counts[2]++;
    else if (avg < 8) counts[3]++;
    else counts[4]++;
  });
  
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      borderWidth: 1,
      textStyle: { color: '#e2e8f0' },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 30, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8' },
    },
    yAxis: {
      type: 'value',
      name: '航线数',
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        type: 'bar',
        data: counts,
        barWidth: '50%',
        itemStyle: {
          color: (params: any) => {
            const colors = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
            return colors[params.dataIndex];
          },
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  };
});

const aircraftUtilizationOption = computed(() => {
  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
  const flightsPerHour = new Array(24).fill(0);
  
  aocStore.duties.forEach(duty => {
    const hour = dayjs(duty.departureTime).hour();
    flightsPerHour[hour]++;
  });
  
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      borderWidth: 1,
      textStyle: { color: '#e2e8f0' },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 30, containLabel: true },
    xAxis: {
      type: 'category',
      data: hours,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 45 },
    },
    yAxis: {
      type: 'value',
      name: '出港航班',
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        type: 'line',
        data: flightsPerHour,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: '#3b82f6' },
        itemStyle: { color: '#3b82f6' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
          ]),
        },
      },
    ],
  };
});
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-slate-100">航线网络分析</h2>
        <p class="text-sm text-slate-500">全球航线网络分布与运营效率分析</p>
      </div>
      <div class="flex items-center gap-2">
        <Globe class="w-5 h-5 text-blue-400" />
        <span class="text-sm text-slate-400">{{ routeStats.length }} 条航线 · {{ airportStats.length }} 个航点</span>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-4 gap-4 mb-6">
      <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-2">
          <MapPin class="w-4 h-4" />
          <span>通航机场</span>
        </div>
        <div class="text-2xl font-bold text-slate-100">{{ airportStats.length }}</div>
      </div>
      <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-2">
          <Plane class="w-4 h-4" />
          <span>航线数量</span>
        </div>
        <div class="text-2xl font-bold text-slate-100">{{ routeStats.length }}</div>
      </div>
      <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-2">
          <TrendingUp class="w-4 h-4" />
          <span>跨时区航线占比</span>
        </div>
        <div class="text-2xl font-bold text-amber-400">
          {{ Math.round((routeStats.filter(r => r.avgTimezoneDiff > 2).length / routeStats.length) * 100) }}%
        </div>
      </div>
      <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-2">
          <Globe class="w-4 h-4" />
          <span>国际航线</span>
        </div>
        <div class="text-2xl font-bold text-blue-400">
          {{ routeStats.filter(r => r.avgTimezoneDiff !== 0).length }}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div class="xl:col-span-2 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
        <h3 class="text-lg font-semibold text-slate-100 mb-4">航线网络拓扑图</h3>
        <p class="text-sm text-slate-500 mb-4">
          节点大小表示机场吞吐量，连线颜色表示跨时区程度（绿色为无时差，红色为大时差）。可拖拽节点调整布局。
        </p>
        <VChart :option="networkOption" autoresize style="height: 500px;" />
      </div>

      <div class="space-y-6">
        <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
          <h3 class="text-lg font-semibold text-slate-100 mb-4">跨时区航线分布</h3>
          <VChart :option="timezoneDistributionOption" autoresize style="height: 250px;" />
        </div>

        <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
          <h3 class="text-lg font-semibold text-slate-100 mb-4">24小时航班出港分布</h3>
          <VChart :option="aircraftUtilizationOption" autoresize style="height: 250px;" />
        </div>
      </div>
    </div>

    <div class="mt-6 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
      <h3 class="text-lg font-semibold text-slate-100 mb-4">繁忙航线排名</h3>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left text-xs text-slate-500 border-b border-slate-700/50">
              <th class="pb-3 font-medium">排名</th>
              <th class="pb-3 font-medium">航线</th>
              <th class="pb-3 font-medium">航班数</th>
              <th class="pb-3 font-medium">累计飞行小时</th>
              <th class="pb-3 font-medium">平均时差</th>
              <th class="pb-3 font-medium">疲劳风险</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(route, idx) in routeStats.slice(0, 10)"
              :key="route.route"
              class="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
            >
              <td class="py-3">
                <span
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium"
                  :class="idx < 3 ? 'bg-amber-600/30 text-amber-400' : 'bg-slate-700/50 text-slate-400'"
                >
                  {{ idx + 1 }}
                </span>
              </td>
              <td class="py-3">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-slate-200">{{ route.route.replace('-', ' → ') }}</span>
                </div>
              </td>
              <td class="py-3 text-slate-200">{{ route.count }}</td>
              <td class="py-3 text-slate-200">{{ route.hours.toFixed(1) }}h</td>
              <td class="py-3">
                <span
                  class="font-medium"
                  :class="route.avgTimezoneDiff > 4 ? 'text-red-400' : route.avgTimezoneDiff > 2 ? 'text-amber-400' : 'text-green-400'"
                >
                  {{ route.avgTimezoneDiff > 0 ? '+' : '' }}{{ route.avgTimezoneDiff.toFixed(1) }}h
                </span>
              </td>
              <td class="py-3">
                <span
                  class="px-2 py-1 text-xs rounded-full"
                  :style="{
                    backgroundColor: route.avgTimezoneDiff > 4 ? 'rgba(239, 68, 68, 0.2)' : route.avgTimezoneDiff > 2 ? 'rgba(249, 115, 22, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                    color: route.avgTimezoneDiff > 4 ? '#ef4444' : route.avgTimezoneDiff > 2 ? '#f97316' : '#22c55e',
                  }"
                >
                  {{ route.avgTimezoneDiff > 4 ? '高风险' : route.avgTimezoneDiff > 2 ? '中风险' : '低风险' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
