const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../');

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
config.resolver.disableHierarchicalLookup = true;

const virtualizedListsPath = path.resolve(
  projectRoot,
  'node_modules/react-native/node_modules/@react-native/virtualized-lists'
);
const webidlConversionsPath = path.resolve(
  workspaceRoot,
  'node_modules/whatwg-url-without-unicode/node_modules/webidl-conversions'
);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@react-native/virtualized-lists': virtualizedListsPath,
  'webidl-conversions': webidlConversionsPath,
};

// Shared-Paket direkt aus TypeScript-Quelle auflösen, damit kein
// pre-kompiliertes dist/ im EAS-Build nötig ist.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@toolshare/shared') {
    return {
      filePath: path.resolve(workspaceRoot, 'shared/index.ts'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
