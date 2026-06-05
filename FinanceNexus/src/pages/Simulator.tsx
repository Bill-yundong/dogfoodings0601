import { useState, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  Play,
  RotateCcw,
  Sliders,
  Zap,
  Target,
  Clock,
  DollarSign,
  Percent,
  Calendar,
} from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Float } from '@react-three/drei';
import * as THREE from 'three';
import { GlassCard } from '../components/ui/GlassCard';
import {
  CompoundEngine,
  MultiScenarioResult,
  SimulationProgress,
} from '../utils/compoundEngine';
import { formatCurrency, formatPercent, formatCompactNumber } from '../utils/compoundEngine';
import { SimulationConfig } from '../types';

function AssetGrowthMesh({ data, color }: { data: number[]; color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const points = useMemo(() => {
    return data.map((value, index) => {
      const normalizedValue = Math.min(value / 10000000, 5);
      return new THREE.Vector3(index - 15, normalizedValue / 2, 0);
    });
  }, [data]);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });

  const lineMaterial = useMemo(() => new THREE.LineBasicMaterial({ color, linewidth: 3 }), [color]);
  const sphereMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }), [color]);

  return (
    <Float speed={1} rotationIntensity={0.2} floatIntensity={0.2}>
      <group ref={groupRef}>
        <primitive object={new THREE.Line(lineGeometry, lineMaterial)} />
        {points.slice(0, -1).map((point, i) => (
          <mesh key={i} position={[point.x, point.y / 2, point.z]} material={sphereMaterial}>
            <sphereGeometry args={[0.1, 8, 8]} />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

function Scene3D({ scenarioData }: { scenarioData: MultiScenarioResult[] }) {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <Grid
        renderOrder={-1}
        position={[0, -0.5, 0]}
        args={[30, 30]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#334155"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#475569"
        fadeDistance={25}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={true}
      />
      {scenarioData.map((scenario, index) => (
        <AssetGrowthMesh
          key={scenario.scenario}
          data={scenario.data.map((d) => d.nominalValue)}
          color={colors[index]}
        />
      ))}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={30}
      />
    </Canvas>
  );
}

export default function Simulator() {
  const [config, setConfig] = useState<Omit<SimulationConfig, 'id' | 'createdAt'>>({
    principal: 100000,
    rate: 7,
    years: 20,
    inflationRate: 2.5,
    compoundFrequency: 'monthly',
    monthlyContribution: 5000,
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState<SimulationProgress>({
    progress: 0,
    status: '',
  });
  const [simulationResults, setSimulationResults] = useState<MultiScenarioResult[]>([]);
  const [show3DView, setShow3DView] = useState(false);

  const handleSimulate = async () => {
    setIsSimulating(true);
    setSimulationProgress({ progress: 0, status: '初始化模拟引擎...' });

    await new Promise((resolve) => setTimeout(resolve, 500));

    const results = await CompoundEngine.runAsyncSimulation(
      {
        ...config,
        rate: config.rate / 100,
        inflationRate: config.inflationRate / 100,
      },
      (progress) => {
        setSimulationProgress(progress);
      }
    );

    setSimulationResults(results);
    setIsSimulating(false);
  };

  const handleReset = () => {
    setConfig({
      principal: 100000,
      rate: 7,
      years: 20,
      inflationRate: 2.5,
      compoundFrequency: 'monthly',
      monthlyContribution: 5000,
    });
    setSimulationResults([]);
  };

  const chartData = useMemo(() => {
    if (simulationResults.length === 0) return [];

    const baseData = simulationResults[0].data.map((d) => ({
      year: d.year,
    }));

    return baseData.map((item, index) => {
      const combined: Record<string, number | string> = { ...item };
      simulationResults.forEach((scenario) => {
        combined[scenario.scenario] = scenario.data[index]?.nominalValue || 0;
        combined[`${scenario.scenario}_实际`] = scenario.data[index]?.realValue || 0;
      });
      return combined;
    });
  }, [simulationResults]);

  const finalValues = useMemo(() => {
    if (simulationResults.length === 0) return [];

    return simulationResults.map((scenario) => {
      const lastData = scenario.data[scenario.data.length - 1];
      return {
        scenario: scenario.scenario,
        color: scenario.color,
        nominalValue: lastData.nominalValue,
        realValue: lastData.realValue,
        totalContributions: lastData.totalContributions,
        totalInterest: lastData.totalInterest,
      };
    });
  }, [simulationResults]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white mb-1">复利演化模拟器</h1>
        <p className="text-primary-400 text-sm">通过异步复利引擎预测资产增长趋势</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <GlassCard className="lg:col-span-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <Sliders className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">参数配置</h3>
              <p className="text-sm text-primary-400">调整模拟参数</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-primary-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  初始本金
                </label>
                <span className="text-sm font-mono text-emerald-400">
                  {formatCurrency(config.principal)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1000000"
                step="10000"
                value={config.principal}
                onChange={(e) => setConfig({ ...config, principal: parseFloat(e.target.value) })}
                className="w-full h-2 bg-primary-100 rounded-full appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-primary-400 flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  年化收益率
                </label>
                <span className="text-sm font-mono text-sky-400">{formatPercent(config.rate)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={config.rate}
                onChange={(e) => setConfig({ ...config, rate: parseFloat(e.target.value) })}
                className="w-full h-2 bg-primary-100 rounded-full appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-primary-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  投资年限
                </label>
                <span className="text-sm font-mono text-amber-400">{config.years} 年</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={config.years}
                onChange={(e) => setConfig({ ...config, years: parseInt(e.target.value) })}
                className="w-full h-2 bg-primary-100 rounded-full appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-primary-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  月定投金额
                </label>
                <span className="text-sm font-mono text-rose-400">
                  {formatCurrency(config.monthlyContribution)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50000"
                step="1000"
                value={config.monthlyContribution}
                onChange={(e) =>
                  setConfig({ ...config, monthlyContribution: parseFloat(e.target.value) })
                }
                className="w-full h-2 bg-primary-100 rounded-full appearance-none cursor-pointer accent-rose-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-primary-400 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  通胀率
                </label>
                <span className="text-sm font-mono text-purple-400">
                  {formatPercent(config.inflationRate)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={config.inflationRate}
                onChange={(e) =>
                  setConfig({ ...config, inflationRate: parseFloat(e.target.value) })
                }
                className="w-full h-2 bg-primary-100 rounded-full appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSimulate}
              disabled={isSimulating}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSimulating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  计算中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  开始模拟
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="p-3 bg-primary-100/50 text-primary-400 rounded-xl hover:bg-primary-100/70 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {isSimulating && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-primary-400">{simulationProgress.status}</span>
                <span className="text-emerald-400 font-mono">{simulationProgress.progress.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full transition-all duration-300"
                  style={{ width: `${simulationProgress.progress}%` }}
                />
              </div>
            </div>
          )}
        </GlassCard>

        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {finalValues.map((item, index) => (
              <GlassCard key={item.scenario} className="text-center" delay={index * 0.1}>
                <div
                  className="w-3 h-3 rounded-full mx-auto mb-2"
                  style={{ backgroundColor: item.color }}
                />
                <p className="text-xs text-primary-400 mb-1">{item.scenario}情景</p>
                <p className="text-lg font-display font-bold" style={{ color: item.color }}>
                  {formatCompactNumber(item.nominalValue)}
                </p>
                <p className="text-xs text-primary-500 mt-1">
                  实际: {formatCompactNumber(item.realValue)}
                </p>
              </GlassCard>
            ))}
          </div>

          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold text-white">资产增长曲线</h3>
                <p className="text-sm text-primary-400">多情景对比分析</p>
              </div>
              <button
                onClick={() => setShow3DView(!show3DView)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  show3DView
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-primary-100/50 text-primary-400 hover:bg-primary-100/70'
                }`}
              >
                {show3DView ? '3D视图' : '3D视图'}
              </button>
            </div>

            {show3DView ? (
              <div className="h-80 rounded-xl overflow-hidden bg-primary-50/5">
                {simulationResults.length > 0 ? (
                  <Scene3D scenarioData={simulationResults} />
                ) : (
                  <div className="flex items-center justify-center h-full text-primary-400">
                    请先运行模拟
                  </div>
                )}
              </div>
            ) : (
              <div className="h-80">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <defs>
                        {simulationResults.map((scenario) => (
                          <linearGradient
                            key={scenario.scenario}
                            id={`gradient-${scenario.scenario}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="5%" stopColor={scenario.color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={scenario.color} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis
                        dataKey="year"
                        stroke="#64748B"
                        fontSize={12}
                        tickLine={false}
                        label={{ value: '年份', position: 'insideBottom', offset: -5, fill: '#64748B' }}
                      />
                      <YAxis
                        stroke="#64748B"
                        fontSize={12}
                        tickLine={false}
                        tickFormatter={(value) => formatCompactNumber(value)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1E293B',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      {simulationResults.map((scenario) => (
                        <Line
                          key={scenario.scenario}
                          type="monotone"
                          dataKey={scenario.scenario}
                          stroke={scenario.color}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-primary-400">
                    点击"开始模拟"查看资产增长曲线
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          {simulationResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard>
                <h3 className="font-display font-semibold text-white mb-4">名义 vs 实际价值</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="nominalGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="realGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis dataKey="year" stroke="#64748B" fontSize={12} tickLine={false} />
                      <YAxis
                        stroke="#64748B"
                        fontSize={12}
                        tickLine={false}
                        tickFormatter={(value) => formatCompactNumber(value)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1E293B',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="基准"
                        name="名义价值"
                        stroke="#10B981"
                        fill="url(#nominalGradient)"
                      />
                      <Area
                        type="monotone"
                        dataKey="基准_实际"
                        name="实际价值(扣除通胀)"
                        stroke="#F59E0B"
                        fill="url(#realGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard>
                <h3 className="font-display font-semibold text-white mb-4">收益构成分析</h3>
                <div className="space-y-4">
                  {finalValues.slice(0, 1).map((item) => (
                    <div key={item.scenario} className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-primary-400 flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            累计投入本金
                          </span>
                          <span className="text-white font-mono">
                            {formatCurrency(item.totalContributions)}
                          </span>
                        </div>
                        <div className="h-3 bg-primary-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full"
                            style={{
                              width: `${(item.totalContributions / item.nominalValue) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-primary-400 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            累计收益
                          </span>
                          <span className="text-emerald-400 font-mono">
                            {formatCurrency(item.totalInterest)}
                          </span>
                        </div>
                        <div className="h-3 bg-primary-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{
                              width: `${(item.totalInterest / item.nominalValue) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-5 h-5 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">复利效应</span>
                        </div>
                        <p className="text-sm text-primary-300">
                          在 {config.years} 年后，您的初始 {formatCurrency(config.principal)} 将增长到{' '}
                          <span className="text-emerald-400 font-bold">
                            {formatCurrency(item.nominalValue)}
                          </span>
                          ，其中 {((item.totalInterest / item.nominalValue) * 100).toFixed(1)}% 来自复利收益！
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
