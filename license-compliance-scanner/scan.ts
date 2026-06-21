#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { scanProject } from './src/scanner';
import { generateReport, generateJsonReport, generateSummary } from './src/report/report-generator';

const program = new Command();

program
  .name('license-scan')
  .description('开源许可证合规扫描工具')
  .version('1.0.0')
  .option('-p, --project <path>', '项目路径', './')
  .option('-o, --output <format>', '输出格式: text|json', 'text')
  .option('-f, --file <file>', '输出到文件')
  .option('--no-dev', '排除开发依赖')
  .option('--min-risk <level>', '最低风险等级: critical|high|medium|low|info', 'info')
  .action((options) => {
    runScan(options);
  });

program
  .command('scan')
  .description('扫描项目的许可证合规性')
  .option('-p, --project <path>', '项目路径', './')
  .option('-o, --output <format>', '输出格式: text|json', 'text')
  .option('-f, --file <file>', '输出到文件')
  .option('--no-dev', '排除开发依赖')
  .option('--min-risk <level>', '最低风险等级: critical|high|medium|low|info', 'info')
  .action((options) => {
    runScan(options);
  });

program
  .command('check')
  .description('快速检查项目是否有许可证问题')
  .option('-p, --project <path>', '项目路径', './')
  .action((options) => {
    runCheck(options);
  });

function runScan(options: any) {
  try {
    const projectPath = path.resolve(options.project);

    if (!fs.existsSync(projectPath)) {
      console.error(`错误: 项目路径不存在: ${projectPath}`);
      process.exit(1);
    }

    const result = scanProject({
      projectPath,
      includeDev: options.dev !== false,
      minRiskLevel: options.minRisk,
    });

    if (options.output === 'json') {
      const jsonReport = generateJsonReport(result);
      if (options.file) {
        fs.writeFileSync(options.file, jsonReport);
        console.log(`报告已保存到: ${options.file}`);
      } else {
        console.log(jsonReport);
      }
    } else {
      const report = generateReport(result);
      if (options.file) {
        fs.writeFileSync(options.file, report);
        console.log(`报告已保存到: ${options.file}`);
      } else {
        console.log(report);
      }
    }

    const summary = generateSummary(result);
    if (summary.hasIssues) {
      process.exit(1);
    }
  } catch (error) {
    console.error('扫描过程中发生错误:', error);
    process.exit(1);
  }
}

function runCheck(options: any) {
  try {
    const projectPath = path.resolve(options.project);

    const result = scanProject({
      projectPath,
      includeDev: true,
    });

    const summary = generateSummary(result);

    console.log(`扫描完成: ${result.totalPackages} 个依赖包`);
    console.log(`冲突数量: ${summary.totalConflicts}`);

    if (summary.hasIssues) {
      console.log('❌ 发现严重/高风险问题，请运行 scan 命令查看详情');
      process.exit(1);
    } else {
      console.log('✅ 未发现严重问题');
    }
  } catch (error) {
    console.error('检查过程中发生错误:', error);
    process.exit(1);
  }
}

program.parse(process.argv);
