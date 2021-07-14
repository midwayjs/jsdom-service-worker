module.exports = {
  preset: 'ts-jest',
  testEnvironment: './',
  testPathIgnorePatterns: ['<rootDir>/dist'],
  coveragePathIgnorePatterns: ['<rootDir>/test/'],
};
