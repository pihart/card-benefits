# Card Benefits Unit Tests

This directory contains comprehensive unit tests for the Card Benefits application.

## Running the Tests

Run the tests from the command line:

```bash
node tests/tests.js
```

The tests will run and display results in the terminal with colored output.

## Test Coverage

The test suite covers all requirements from the issue:

### 1. Different Expiry Types
- ✅ Monthly calendar reset
- ✅ Quarterly calendar reset
- ✅ Biannual calendar reset
- ✅ Annual calendar reset
- ✅ Every-4-years calendar reset
- ✅ Monthly anniversary reset
- ✅ Quarterly anniversary reset
- ✅ Biannual anniversary reset
- ✅ Annual anniversary reset
- ✅ One-time benefits (no reset)

### 2. Carryover Awards - Multiple Instances
- ✅ Earning in new year does not affect previous year's benefit
- ✅ Using previous year's credit does not affect new year's credit
- ✅ Successfully earning in new year does not spoil previous year
- ✅ Carryover instance expiry (earned in year X expires end of year X+1)
- ✅ Can only earn once per calendar year

### 3. Day-by-Day Simulation
- ✅ Monthly benefit - simulate each day in period
- ✅ Carryover benefit - simulate year boundary crossing
- ✅ Multiple benefits - identify correct items for reset on specific day

### 4. Declining Reset (Data Preservation)
- ✅ Benefit data preserved when reset is not performed
- ✅ Carryover instances preserved (not deleted)
- ✅ Card with multiple benefits - selective reset

### 5. Additional Tests
- ✅ Expiring soon detection for regular benefits
- ✅ Expiring soon detection for carryover instances

## Test Structure

The tests are organized into 7 test suites:

1. **Expiry Types - Calendar Reset** (5 tests)
2. **Expiry Types - Anniversary Reset** (4 tests)
3. **One-time Benefits** (1 test)
4. **Carryover Awards - Multiple Instances** (5 tests)
5. **Day-by-Day Simulation** (3 tests)
6. **Declining Reset - Data Preservation** (3 tests)
7. **Expiring Soon Detection** (2 tests)

**Total: 23 tests**

## Test Framework

The tests use a simple, custom test framework with the following assertion methods:

- `assertEquals(actual, expected, message)` - Checks equality
- `assertTrue(value, message)` - Checks if value is true
- `assertFalse(value, message)` - Checks if value is false
- `assertArrayLength(array, length, message)` - Checks array length
- `assertDateEquals(actual, expected, message)` - Checks date equality

## Exit Codes

When running `tests/tests.js`:
- Exit code `0` - All tests passed
- Exit code `1` - One or more tests failed

This makes it easy to integrate into CI/CD pipelines.
