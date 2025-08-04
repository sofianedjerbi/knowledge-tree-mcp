/**
 * Test data and utilities for path update tests
 */

import type { UpdateArgs, KnowledgeEntry } from '../../src/types/index.js';

export const createTestEntry = (overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry => ({
  title: 'Test Entry',
  priority: 'COMMON',
  problem: 'Test problem',
  solution: 'Test solution',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides
});

export const testCases = {
  // Basic path regeneration test
  pathRegenerationTest: {
    initialEntry: createTestEntry({
      title: 'How to setup Redis cluster',
      tags: ['redis', 'database', 'cluster'],
      category: 'database'
    }),
    oldPath: 'database/redis/how-to/setup-cluster.json',
    updateArgs: {
      regenerate_path: true,
      updates: {
        title: 'How to configure MongoDB replica set',
        tags: ['mongodb', 'database', 'replica']
      }
    } as Partial<UpdateArgs>
  },

  // No path regeneration test
  noPathRegenerationTest: {
    initialEntry: createTestEntry({
      title: 'How to setup Redis cluster',
      tags: ['redis', 'database']
    }),
    oldPath: 'database/redis/how-to/setup-cluster.json',
    updateArgs: {
      regenerate_path: false,
      updates: {
        title: 'How to configure MongoDB replica set'
      }
    } as Partial<UpdateArgs>
  },

  // Minimal title change test
  minimalChangeTest: {
    initialEntry: createTestEntry({
      title: 'How to setup Redis cluster',
      tags: ['redis', 'database']
    }),
    oldPath: 'database/redis/how-to/setup-cluster.json',
    updateArgs: {
      regenerate_path: true,
      updates: {
        title: 'How to set up Redis cluster' // Minimal change
      }
    } as Partial<UpdateArgs>
  },

  // Reference move test
  referenceMoveTest: {
    sourceEntry: createTestEntry({
      title: 'Redis Cluster Setup',
      related_to: [{
        path: 'database/redis/troubleshooting/connection-issues.json',
        relationship: 'related',
        description: 'Common issues'
      }]
    }),
    targetEntry: createTestEntry({
      title: 'Redis Connection Issues',
      related_to: [{
        path: 'database/redis/how-to/setup-cluster.json',
        relationship: 'related',
        description: 'Setup guide'
      }]
    }),
    oldPath: 'database/redis/how-to/setup-cluster.json',
    newPath: 'database/mongodb/how-to/setup-replica-set.json',
    targetPath: 'database/redis/troubleshooting/connection-issues.json'
  },

  // Conflict resolution test
  conflictTest: {
    sourceEntry: createTestEntry({ title: 'Source Entry' }),
    conflictEntry: createTestEntry({ title: 'Conflict Entry' }),
    oldPath: 'test/source.json',
    newPath: 'test/target.json'
  },

  // Complex reference chain test
  referenceChainTest: {
    entryA: createTestEntry({
      title: 'Entry A',
      related_to: [{ path: 'test/b.json', relationship: 'related' }]
    }),
    entryB: createTestEntry({
      title: 'Entry B',
      related_to: [
        { path: 'test/a.json', relationship: 'related' },
        { path: 'test/c.json', relationship: 'supersedes' }
      ]
    }),
    entryC: createTestEntry({
      title: 'Entry C',
      related_to: [{ path: 'test/b.json', relationship: 'superseded_by' }]
    }),
    moveFrom: 'test/a.json',
    moveTo: 'moved/a.json'
  },

  // Incoming references test
  incomingRefsTest: {
    sourceEntry: createTestEntry({ title: 'Source' }),
    referencingEntry: createTestEntry({
      title: 'Referencing',
      related_to: [{
        path: 'test/source.json',
        relationship: 'related'
      }]
    }),
    oldPath: 'test/source.json',
    newPath: 'test/new-location.json',
    referencingPath: 'test/referencing.json'
  },

  // Missing title test
  missingTitleTest: {
    initialEntry: createTestEntry({
      title: 'Original Title'
    }),
    oldPath: 'test/entry.json',
    updateArgs: {
      regenerate_path: true,
      updates: {
        problem: 'Updated problem' // No title change
      }
    } as Partial<UpdateArgs>
  }
};

export const directoryStructures = {
  redis: ['database', 'redis', 'how-to'],
  mongoTroubleshooting: ['database', 'redis', 'troubleshooting'],
  mongoHowTo: ['database', 'mongodb', 'how-to'],
  test: ['test'],
  moved: ['moved']
};