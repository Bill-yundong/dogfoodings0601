## 1. 架构设计

```mermaid
graph TB
    subgraph "前端层"
        A["SolidJS 应用层"]
        B["UI 组件库"]
        C["状态管理 (Solid Store)"]
    end
    
    subgraph "计算层"
        D["Web Worker 池"]
        E["保真度计算引擎"]
        F["拉比振荡模型"]
    end
    
    subgraph "数据层"
        G["IndexedDB 存储"]
        H["量子纠错数据库"]
        I["实时数据缓存"]
    end
    
    subgraph "协议层"
        J["协议同步模块"]
        K["物理底层通信接口"]
    end
    
    A --> D
    A --> J
    D --> E
    D --> F
    A --> G
    J --> K
    E --> G
    F --> G
    G --> H
    G --> I
```

## 2. 技术描述

- **前端框架**: SolidJS 1.8 + TypeScript 5.3
- **构建工具**: Vite 5.0
- **样式方案**: TailwindCSS 3.4 + CSS 变量
- **图表库**: Chart.js 4.4 + 自定义 Canvas 渲染
- **状态管理**: SolidJS Stores 原生状态管理
- **Web Worker**: 原生 Web Worker API + Comlink
- **数据存储**: IndexedDB (idb 封装库)
- **路由**: @solidjs/router 0.13
- **字体**: Google Fonts (JetBrains Mono, Space Grotesk)

## 3. 路由定义

| 路由 | 页面名称 | 用途 |
|-------|---------|------|
| /dashboard | 监控仪表盘 | 激光相干性实时监控与系统概览 |
| /rabi-oscillation | 拉比振荡 | 概率模型配置与协议同步控制 |
| /fidelity | 保真度计算 | 量子逻辑门保真度异步计算面板 |
| /error-correction | 量子纠错 | 校验子快照管理与纠错循环分析 |
| /settings | 系统设置 | 物理底层连接与系统参数配置 |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    LASER_COHERENCE {
        bigint id PK
        float timestamp
        float coherence_value
        int qubit_id
        string phase_noise
    }
    
    RABI_OSCILLATION {
        bigint id PK
        float timestamp
        float probability
        float omega
        float delta
        int qubit_id
    }
    
    FIDELITY_RESULT {
        bigint id PK
        string gate_type
        float fidelity
        float error_rate
        json parameters
        float compute_time
    }
    
    SYNDROME_SNAPSHOT {
        bigint id PK
        int cycle_number
        json syndrome_data
        float error_probability
        float timestamp
        string correction_result
    }
    
    PROTOCOL_SYNC {
        bigint id PK
        string sync_id
        string status
        float sync_time
        json payload
        string direction
    }
```

### 4.2 IndexedDB Store 定义

```typescript
interface DBSchema {
  laserCoherence: {
    key: number;
    value: LaserCoherenceRecord;
    indexes: { 'by-timestamp': number; 'by-qubit': number };
  };
  rabiOscillation: {
    key: number;
    value: RabiOscillationRecord;
    indexes: { 'by-timestamp': number };
  };
  fidelityResults: {
    key: number;
    value: FidelityResult;
    indexes: { 'by-gate-type': string };
  };
  syndromeSnapshots: {
    key: number;
    value: SyndromeSnapshot;
    indexes: { 'by-cycle': number; 'by-timestamp': number };
  };
  protocolSync: {
    key: number;
    value: ProtocolSyncRecord;
    indexes: { 'by-sync-id': string };
  };
}
```

## 5. Web Worker 架构

```mermaid
graph LR
    A["主线程 UI"] -->|发送计算任务| B["Worker Manager"]
    B -->|分发| C["Worker 1"]
    B -->|分发| D["Worker 2"]
    B -->|分发| E["Worker N"]
    C -->|量子门矩阵运算| F["保真度计算"]
    D -->|密度矩阵演化| G["拉比模型求解"]
    E -->|量子纠错模拟| H["校验子计算"]
    F --> I["结果汇总"]
    G --> I
    H --> I
    I -->|回传结果| A
```

## 6. 核心模块接口定义

### 6.1 协议同步模块

```typescript
interface ProtocolSyncService {
  connect(endpoint: string): Promise<boolean>;
  disconnect(): void;
  sync(payload: SyncPayload): Promise<SyncResult>;
  onSync(callback: (data: SyncData) => void): () => void;
  getStatus(): SyncStatus;
}
```

### 6.2 保真度计算接口

```typescript
interface FidelityCalculator {
  calculateGateFidelity(
    gateType: QuantumGate,
    params: GateParams
  ): Promise<FidelityResult>;
  calculateAverageFidelity(
    gates: QuantumGate[],
    iterations: number
  ): Promise<FidelityReport>;
}
```

### 6.3 量子纠错存储接口

```typescript
interface SyndromeStore {
  saveSnapshot(snapshot: SyndromeSnapshot): Promise<number>;
  getSnapshotsByCycle(cycle: number): Promise<SyndromeSnapshot[]>;
  getSnapshotsInRange(start: number, end: number): Promise<SyndromeSnapshot[]>;
  countSnapshots(): Promise<number>;
  clearOldSnapshots(before: Date): Promise<number>;
}
```
