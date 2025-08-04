# Constants Module

This module contains all application-wide constants for the Knowledge Tree MCP system, following best practices for maintainability and type safety.

## Structure

```
constants/
├── index.ts           # Central export point
├── priorities.ts      # Priority levels and related constants
├── relationships.ts   # Relationship types and mappings
└── defaults.ts        # Default values and configuration
```

## Best Practices Applied

### 1. **Type Safety**
- All constants are strongly typed using TypeScript's `as const` assertions
- Type guards are provided for runtime validation
- Constants are tied to their corresponding types from the `types/` module

### 2. **Single Source of Truth**
- Each constant is defined in exactly one place
- Related constants are grouped together logically
- No magic strings or numbers in the codebase

### 3. **Immutability**
- All constants use `as const` to ensure compile-time immutability
- Objects are frozen at the type level to prevent modifications

### 4. **Documentation**
- Each constant group has JSDoc comments explaining its purpose
- Related helper functions are provided where useful

### 5. **Modularity**
- Constants are organized by domain/feature
- Each file has a clear, single responsibility
- Easy to find and update specific constants

## Usage Examples

### Priority Constants
```typescript
import { PRIORITY_WEIGHTS, isValidPriority, comparePriorities } from '@/constants';

// Check if a value is valid
if (isValidPriority(userInput)) {
  // Type is now narrowed to Priority
  const weight = PRIORITY_WEIGHTS[userInput];
}

// Sort by priority
entries.sort((a, b) => comparePriorities(a.priority, b.priority));
```

### Relationship Constants
```typescript
import { isBidirectionalRelationship, getInverseRelationship } from '@/constants';

// Check if we need to create a reverse link
if (isBidirectionalRelationship(relationship)) {
  // Create bidirectional link
}

// Get the inverse relationship
const inverse = getInverseRelationship('supersedes'); // 'superseded_by'
```

### Default Values
```typescript
import { SEARCH_DEFAULTS, getDefaultValue } from '@/constants';

// Use defaults with destructuring
const searchOptions = {
  ...SEARCH_DEFAULTS,
  ...userOptions
};

// Or get specific defaults
const limit = getDefaultValue('search', 'LIMIT'); // 50
```

### Quick Access via Constants Object
```typescript
import { Constants } from '@/constants';

// Common validations
if (!Constants.VALID_PATH_PATTERN.test(path)) {
  throw new Error(Constants.ERRORS.INVALID_PATH);
}

// Check file extension
const isJson = path.endsWith(Constants.JSON_EXTENSION);
```

## Adding New Constants

When adding new constants:

1. **Determine the appropriate file**:
   - Priority-related → `priorities.ts`
   - Relationship-related → `relationships.ts`
   - Everything else → `defaults.ts`

2. **Follow the naming convention**:
   - Use SCREAMING_SNAKE_CASE for constant values
   - Use camelCase for functions
   - Group related constants in objects

3. **Add type safety**:
   - Use `as const` assertions
   - Provide TypeScript types
   - Add validation functions if needed

4. **Export from index.ts**:
   - Add to the appropriate export block
   - Update the Constants object if it's commonly used

5. **Document the constant**:
   - Add JSDoc comments
   - Explain the purpose and usage
   - Include examples if helpful

## Benefits

1. **Maintainability**: Change a value in one place, updates everywhere
2. **Type Safety**: TypeScript ensures correct usage at compile time
3. **Discoverability**: Auto-complete shows all available constants
4. **Consistency**: Enforces naming conventions and patterns
5. **Testing**: Easy to mock or override constants in tests