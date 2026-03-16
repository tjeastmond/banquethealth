const path = require('path')

const config = {
  rootDir: '../',
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
    ],
  },
  globalSetup: path.join(__dirname, './jest.global-setup.ts'),
  setupFilesAfterEnv: [
    path.join(__dirname, './jest.setup-after-env.ts'),
  ],
  maxWorkers: 1,
  testTimeout: 20000,
}

module.exports = config
