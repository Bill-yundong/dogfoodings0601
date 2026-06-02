import type { SensorEvent, SemanticMapping } from '@/types'

const DEFAULT_MAPPINGS: SemanticMapping[] = [
  { id: 'sm-1', securityTerm: '入侵警报', homeControlTerm: '迎宾模式', unifiedSemantics: '人员进出检测', category: 'presence', priorityWeight: 0.9 },
  { id: 'sm-2', securityTerm: '布防模式', homeControlTerm: '离家场景', unifiedSemantics: '全屋设防', category: 'mode', priorityWeight: 0.95 },
  { id: 'sm-3', securityTerm: '撤防模式', homeControlTerm: '回家场景', unifiedSemantics: '全屋解除', category: 'mode', priorityWeight: 0.95 },
  { id: 'sm-4', securityTerm: '门磁触发', homeControlTerm: '灯光联动', unifiedSemantics: '门窗开合感知', category: 'door', priorityWeight: 0.7 },
  { id: 'sm-5', securityTerm: '烟感报警', homeControlTerm: '通风系统', unifiedSemantics: '空气质量异常', category: 'safety', priorityWeight: 0.98 },
  { id: 'sm-6', securityTerm: '移动侦测', homeControlTerm: '自动化场景', unifiedSemantics: '区域活动检测', category: 'motion', priorityWeight: 0.8 },
  { id: 'sm-7', securityTerm: '门窗传感器', homeControlTerm: '空调联动', unifiedSemantics: '环境封闭检测', category: 'environment', priorityWeight: 0.6 },
  { id: 'sm-8', securityTerm: '紧急按钮', homeControlTerm: '全屋关断', unifiedSemantics: '紧急响应触发', category: 'emergency', priorityWeight: 1.0 },
]

export class SemanticAligner {
  private mappings: Map<string, SemanticMapping> = new Map()
  private categoryIndex: Map<string, SemanticMapping[]> = new Map()

  constructor(mappings?: SemanticMapping[]) {
    const list = mappings ?? DEFAULT_MAPPINGS
    list.forEach((m) => this.addMapping(m))
  }

  addMapping(mapping: SemanticMapping): void {
    this.mappings.set(mapping.id, mapping)
    const cat = mapping.category
    if (!this.categoryIndex.has(cat)) {
      this.categoryIndex.set(cat, [])
    }
    this.categoryIndex.get(cat)!.push(mapping)
  }

  align(event: SensorEvent): { unified: string; category: string; weight: number } {
    for (const [, mapping] of this.mappings) {
      if (event.source === 'security_system' && event.label.includes(mapping.securityTerm)) {
        return { unified: mapping.unifiedSemantics, category: mapping.category, weight: mapping.priorityWeight }
      }
      if (event.source === 'home_control' && event.label.includes(mapping.homeControlTerm)) {
        return { unified: mapping.unifiedSemantics, category: mapping.category, weight: mapping.priorityWeight }
      }
    }
    return { unified: event.label, category: event.type, weight: 0.5 }
  }

  checkConflict(eventA: SensorEvent, eventB: SensorEvent): boolean {
    const alignA = this.align(eventA)
    const alignB = this.align(eventB)
    if (alignA.category === alignB.category && eventA.source !== eventB.source) {
      if (Math.abs(alignA.weight - alignB.weight) < 0.3) return true
      if (alignA.weight > 0.8 && alignB.weight > 0.8) return true
    }
    return false
  }

  getMappings(): SemanticMapping[] {
    return Array.from(this.mappings.values())
  }

  getMappingsByCategory(category: string): SemanticMapping[] {
    return this.categoryIndex.get(category) ?? []
  }
}

export const semanticAligner = new SemanticAligner()
