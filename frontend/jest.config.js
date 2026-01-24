module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/?(*.)+(test).[tj]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|react-native|expo(nent)?|@expo(nent)?|@noble/.*)',
  ],
};
