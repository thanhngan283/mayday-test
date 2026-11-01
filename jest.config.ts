import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  // Chạy tuần tự để đảm bảo tính toàn vẹn dữ liệu trên Real API & Database
  maxWorkers: 1,
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './reports',
        filename: 'test-report.html',
        pageTitle: 'Dr.Mayday Real API Automation Test Report (10 Weeks)',
        expand: true,
        openReport: false,
        hideIcon: false,
        includeFailureMsg: true,
        includeConsoleLog: true
      }
    ]
  ]
};

export default config;
