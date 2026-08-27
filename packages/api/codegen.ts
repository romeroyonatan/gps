import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: '../../schema.gql',
  documents: ['src/queries/**/*.graphql'],
  generates: {
    './src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typed-document-node'],
      config: { useTypeImports: true, enumsAsTypes: true },
    },
  },
}

export default config
