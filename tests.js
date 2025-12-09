#!/usr/bin/env node

/**
 * Unit tests for Card Benefits application
 * Run with: node tests.js
 */

const fs = require('fs');
const path = require('path');

// Load model classes (they define global classes)
// Using vm.runInThisContext to execute in current global scope
const vm = require('vm');

function loadModule(filepath) {
    const code = fs.readFileSync(filepath, 'utf8');
    // Execute in the current global context
    vm.runInThisContext(code);
}

// Load all required modules in dependency order
loadModule(path.join(__dirname, 'models/ExpiryCycle.js'));
loadModule(path.join(__dirname, 'models/CarryoverCycle.js'));
loadModule(path.join(__dirname, 'models/MinimumSpend.js'));
loadModule(path.join(__dirname, 'models/Benefit.js'));
loadModule(path.join(__dirname, 'models/Card.js'));
loadModule(path.join(__dirname, 'dateUtils.js'));

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    bold: '\x1b[1m'
};

// Simple test framework
class TestRunner {
    constructor() {
        this.suites = [];
        this.totalPass = 0;
        this.totalFail = 0;
    }

    suite(name, fn) {
        const suite = { name, tests: [] };
        this.suites.push(suite);
        fn({
            test: (testName, testFn) => {
                suite.tests.push({ name: testName, fn: testFn });
            }
        });
    }

    async run() {
        console.log(`\n${colors.bold}${colors.blue}💳 Card Benefits Unit Tests${colors.reset}\n`);

        for (const suite of this.suites) {
            console.log(`${colors.bold}${suite.name}${colors.reset}`);

            for (const test of suite.tests) {
                try {
                    await test.fn();
                    console.log(`  ${colors.green}✓${colors.reset} ${test.name}`);
                    this.totalPass++;
                } catch (error) {
                    console.log(`  ${colors.red}✗${colors.reset} ${test.name}`);
                    console.log(`    ${colors.red}${error.message}${colors.reset}`);
                    if (error.stack) {
                        const stackLines = error.stack.split('\n').slice(1, 3);
                        stackLines.forEach(line => console.log(`    ${colors.red}${line.trim()}${colors.reset}`));
                    }
                    this.totalFail++;
                }
            }
            console.log('');
        }

        // Print summary
        const total = this.totalPass + this.totalFail;
        const summaryColor = this.totalFail === 0 ? colors.green : colors.red;
        console.log(`${colors.bold}${summaryColor}Tests: ${total} | Passed: ${this.totalPass} | Failed: ${this.totalFail}${colors.reset}\n`);

        // Exit with error code if any tests failed
        if (this.totalFail > 0) {
            process.exit(1);
        }
    }
}

// Assertion helpers
function assertEquals(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

function assertTrue(value, message = '') {
    if (!value) {
        throw new Error(message || 'Expected true but got false');
    }
}

function assertFalse(value, message = '') {
    if (value) {
        throw new Error(message || 'Expected false but got true');
    }
}

function assertArrayLength(array, length, message = '') {
    if (!Array.isArray(array)) {
        throw new Error(`${message}\nExpected array but got ${typeof array}`);
    }
    if (array.length !== length) {
        throw new Error(`${message}\nExpected array length ${length} but got ${array.length}`);
    }
}

function assertDateEquals(actual, expected, message = '') {
    const actualTime = actual instanceof Date ? actual.getTime() : new Date(actual).getTime();
    const expectedTime = expected instanceof Date ? expected.getTime() : new Date(expected).getTime();
    if (actualTime !== expectedTime) {
        throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

// Initialize test runner
const runner = new TestRunner();

// ============================================================
// TEST SUITES
// ============================================================

// Test Suite 1: Different Expiry Types - Calendar Reset
runner.suite('Expiry Types - Calendar Reset', ({ test }) => {
    test('Monthly calendar reset', () => {
        const lastReset = new Date('2024-01-15');
        const cycle = new ExpiryCycle({
            frequency: 'monthly',
            resetType: 'calendar',
            lastReset: lastReset.toISOString()
        });

        const nextReset = cycle.calculateNextResetDate(new Date('2024-01-20'));
        assertDateEquals(nextReset, new Date('2024-02-01'), 'Next reset should be Feb 1');

        assertTrue(cycle.isExpired(new Date('2024-02-01')), 'Should be expired on Feb 1');
        assertFalse(cycle.isExpired(new Date('2024-01-31')), 'Should not be expired on Jan 31');
    });

    test('Quarterly calendar reset', () => {
        const lastReset = new Date('2024-01-15');
        const cycle = new ExpiryCycle({
            frequency: 'quarterly',
            resetType: 'calendar',
            lastReset: lastReset.toISOString()
        });

        const nextReset = cycle.calculateNextResetDate(new Date('2024-01-20'));
        assertDateEquals(nextReset, new Date('2024-04-01'), 'Next reset should be Apr 1');

        assertFalse(cycle.isExpired(new Date('2024-03-31')), 'Should not be expired on Mar 31');
        assertTrue(cycle.isExpired(new Date('2024-04-01')), 'Should be expired on Apr 1');
    });

    test('Biannual calendar reset', () => {
        const lastReset = new Date('2024-01-15');
        const cycle = new ExpiryCycle({
            frequency: 'biannual',
            resetType: 'calendar',
            lastReset: lastReset.toISOString()
        });

        const nextReset = cycle.calculateNextResetDate(new Date('2024-01-20'));
        assertDateEquals(nextReset, new Date('2024-07-01'), 'Next reset should be Jul 1');

        // Test second half of year
        const lastResetH2 = new Date('2024-08-15');
        const cycleH2 = new ExpiryCycle({
            frequency: 'biannual',
            resetType: 'calendar',
            lastReset: lastResetH2.toISOString()
        });
        const nextResetH2 = cycleH2.calculateNextResetDate(new Date('2024-08-20'));
        assertDateEquals(nextResetH2, new Date('2025-01-01'), 'Next reset should be Jan 1 next year');
    });

    test('Annual calendar reset', () => {
        const lastReset = new Date('2024-03-15');
        const cycle = new ExpiryCycle({
            frequency: 'annual',
            resetType: 'calendar',
            lastReset: lastReset.toISOString()
        });

        const nextReset = cycle.calculateNextResetDate(new Date('2024-06-15'));
        assertDateEquals(nextReset, new Date('2025-01-01'), 'Next reset should be Jan 1 next year');
    });

    test('Every-4-years calendar reset', () => {
        const lastReset = new Date('2024-01-15');
        const cycle = new ExpiryCycle({
            frequency: 'every-4-years',
            resetType: 'calendar',
            lastReset: lastReset.toISOString()
        });

        const nextReset = cycle.calculateNextResetDate(new Date('2024-06-15'));
        assertDateEquals(nextReset, new Date('2028-01-01'), 'Next reset should be Jan 1, 2028');
    });
});

// Test Suite 2: Different Expiry Types - Anniversary Reset
runner.suite('Expiry Types - Anniversary Reset', ({ test }) => {
    test('Monthly anniversary reset', () => {
        const anniversaryDate = new Date('2020-03-15'); // Card anniversary on 15th
        const lastReset = new Date('2024-05-15');
        const cycle = new ExpiryCycle({
            frequency: 'monthly',
            resetType: 'anniversary',
            lastReset: lastReset.toISOString(),
            anniversaryDate: anniversaryDate
        });

        const nextReset = cycle.calculateNextResetDate(new Date('2024-05-20'));
        assertDateEquals(nextReset, new Date('2024-06-15'), 'Next reset should be Jun 15');
    });

    test('Quarterly anniversary reset', () => {
        const anniversaryDate = new Date('2020-03-15'); // Card anniversary on Mar 15
        const lastReset = new Date('2024-03-15');
        const cycle = new ExpiryCycle({
            frequency: 'quarterly',
            resetType: 'anniversary',
            lastReset: lastReset.toISOString(),
            anniversaryDate: anniversaryDate
        });

        const nextReset = cycle.calculateNextResetDate(new Date('2024-03-20'));
        assertDateEquals(nextReset, new Date('2024-06-15'), 'Next reset should be Jun 15');
    });

    test('Biannual anniversary reset', () => {
        const anniversaryDate = new Date('2020-03-15'); // Card anniversary on Mar 15
        const lastReset = new Date('2024-03-15');
        const cycle = new ExpiryCycle({
            frequency: 'biannual',
            resetType: 'anniversary',
            lastReset: lastReset.toISOString(),
            anniversaryDate: anniversaryDate
        });

        const nextReset = cycle.calculateNextResetDate(new Date('2024-03-20'));
        assertDateEquals(nextReset, new Date('2024-09-15'), 'Next reset should be Sep 15');
    });

    test('Annual anniversary reset', () => {
        const anniversaryDate = new Date('2020-03-15'); // Card anniversary on Mar 15
        const lastReset = new Date('2024-03-15');
        const cycle = new ExpiryCycle({
            frequency: 'annual',
            resetType: 'anniversary',
            lastReset: lastReset.toISOString(),
            anniversaryDate: anniversaryDate
        });

        const nextReset = cycle.calculateNextResetDate(new Date('2024-06-20'));
        assertDateEquals(nextReset, new Date('2025-03-15'), 'Next reset should be Mar 15, 2025');
    });
});

// Test Suite 3: One-time Benefits
runner.suite('One-time Benefits', ({ test }) => {
    test('One-time benefit should not reset', () => {
        const benefit = new Benefit({
            description: 'One-time $100 credit',
            totalAmount: 100,
            usedAmount: 0,
            frequency: 'one-time',
            resetType: null,
            lastReset: null
        });

        assertTrue(benefit.isOneTime(), 'Should be one-time');
        assertFalse(benefit.isRecurring(), 'Should not be recurring');
        assertFalse(benefit.needsReset(new Date('2024-12-31')), 'Should never need reset');
        assertEquals(benefit.getNextResetDate(new Date('2024-12-31')), null, 'Should have no next reset date');
    });
});

// Test Suite 4: Carryover Awards - Multiple Instances
runner.suite('Carryover Awards - Multiple Instances', ({ test }) => {
    test('Earning in new year does not affect previous year benefit', () => {
        const benefit = new Benefit({
            description: 'Carryover $300 credit',
            totalAmount: 300,
            frequency: 'carryover',
            isCarryover: true,
            earnedInstances: [
                { earnedDate: '2023-06-15', usedAmount: 100 }
            ]
        });

        // Check 2023 instance data before earning 2024
        assertEquals(benefit.earnedInstances[0].usedAmount, 100, '2023 instance should have $100 used');
        assertEquals(benefit.earnedInstances[0].earnedDate, '2023-06-15', '2023 earned date');
        
        const currentDate2023 = new Date('2023-12-01');
        const remaining2023Before = benefit.getTotalCarryoverRemaining(currentDate2023);
        assertEquals(remaining2023Before, 200, 'Should have $200 remaining from 2023');

        // Earn 2024 instance
        benefit.earnedInstances.push({ earnedDate: '2024-06-15', usedAmount: 0 });

        // The key test: Check that 2023 instance data is unchanged (not affected by earning 2024)
        assertEquals(benefit.earnedInstances[0].usedAmount, 100, '2023 instance should still have $100 used');
        assertEquals(benefit.earnedInstances[0].earnedDate, '2023-06-15', '2023 earned date unchanged');
        
        // Verify we have both instances
        assertArrayLength(benefit.earnedInstances, 2, 'Should have 2 instances');
        
        // Check 2024 - should have both instances active
        const currentDate2024 = new Date('2024-12-01');
        const remaining2024 = benefit.getTotalCarryoverRemaining(currentDate2024);
        assertEquals(remaining2024, 500, 'Should have $500 total ($200 from 2023 + $300 from 2024)');
    });

    test('Using previous year credit does not affect new year credit', () => {
        const benefit = new Benefit({
            description: 'Carryover $300 credit',
            totalAmount: 300,
            frequency: 'carryover',
            isCarryover: true,
            earnedInstances: [
                { earnedDate: '2023-06-15', usedAmount: 0 },
                { earnedDate: '2024-06-15', usedAmount: 0 }
            ]
        });

        // Use up the 2023 instance
        benefit.setCarryoverInstanceUsage(0, 300);

        const currentDate = new Date('2024-12-01');
        const remaining = benefit.getTotalCarryoverRemaining(currentDate);
        assertEquals(remaining, 300, '2024 instance should still have full $300');

        // Verify 2023 instance is fully used
        assertEquals(benefit.earnedInstances[0].usedAmount, 300, '2023 should be fully used');
        assertEquals(benefit.earnedInstances[1].usedAmount, 0, '2024 should be untouched');
    });

    test('Successfully earning in new year does not spoil previous year', () => {
        const benefit = new Benefit({
            description: 'Carryover $300 credit',
            totalAmount: 300,
            frequency: 'carryover',
            isCarryover: true,
            earnedInstances: [
                { earnedDate: '2023-06-15', usedAmount: 50 }
            ]
        });

        // Verify 2023 instance before
        assertEquals(benefit.earnedInstances[0].usedAmount, 50, '2023 should have $50 used');

        // Earn 2024 instance
        benefit.earnedInstances.push({ earnedDate: '2024-06-15', usedAmount: 0 });

        // Verify 2023 instance is unchanged
        assertEquals(benefit.earnedInstances[0].usedAmount, 50, '2023 should still have $50 used');
        assertEquals(benefit.earnedInstances[0].earnedDate, '2023-06-15', '2023 earned date unchanged');

        // Verify we have both instances
        assertArrayLength(benefit.earnedInstances, 2, 'Should have 2 instances');

        const currentDate = new Date('2024-12-01');
        const remaining = benefit.getTotalCarryoverRemaining(currentDate);
        assertEquals(remaining, 550, 'Should have $550 total ($250 from 2023 + $300 from 2024)');
    });

    test('Carryover instance expiry - earned in year X expires end of year X+1', () => {
        const benefit = new Benefit({
            description: 'Carryover $300 credit',
            totalAmount: 300,
            frequency: 'carryover',
            isCarryover: true,
            earnedInstances: [
                { earnedDate: '2023-06-15', usedAmount: 0 }
            ]
        });

        // Should be active in 2023
        const date2023 = new Date('2023-12-31');
        assertTrue(benefit.hasActiveCarryoverInstances(date2023), 'Should be active in 2023');

        // Should be active throughout 2024
        const date2024Mid = new Date('2024-06-15');
        assertTrue(benefit.hasActiveCarryoverInstances(date2024Mid), 'Should be active in mid 2024');

        const date2024End = new Date('2024-12-31');
        assertTrue(benefit.hasActiveCarryoverInstances(date2024End), 'Should be active until end of 2024');

        // Should expire in 2025
        const date2025 = new Date('2025-01-01');
        assertFalse(benefit.hasActiveCarryoverInstances(date2025), 'Should expire on Jan 1, 2025');
    });

    test('Can only earn carryover once per calendar year', () => {
        const benefit = new Benefit({
            description: 'Carryover $300 credit',
            totalAmount: 300,
            frequency: 'carryover',
            isCarryover: true,
            earnedInstances: []
        });

        // Can earn in 2023
        const date2023a = new Date('2023-06-15');
        assertTrue(benefit.canEarnCarryoverThisYear(date2023a), 'Should be able to earn in 2023');

        // Earn it
        benefit.earnedInstances.push({ earnedDate: '2023-06-15', usedAmount: 0 });

        // Cannot earn again in 2023
        const date2023b = new Date('2023-12-15');
        assertFalse(benefit.canEarnCarryoverThisYear(date2023b), 'Should not be able to earn again in 2023');

        // Can earn in 2024
        const date2024 = new Date('2024-06-15');
        assertTrue(benefit.canEarnCarryoverThisYear(date2024), 'Should be able to earn in 2024');
    });
});

// Test Suite 5: Day-by-Day Simulation
runner.suite('Day-by-Day Simulation', ({ test }) => {
    test('Monthly benefit - simulate each day in period', () => {
        const card = new Card({
            name: 'Test Card',
            anniversaryDate: '2020-01-15',
            benefits: [{
                description: 'Monthly $50 credit',
                totalAmount: 50,
                usedAmount: 0,
                frequency: 'monthly',
                resetType: 'calendar',
                lastReset: '2024-01-01'
            }]
        });

        const benefit = card.benefits[0];

        // Test each day in January - should not need reset
        for (let day = 1; day <= 31; day++) {
            const date = new Date(2024, 0, day); // January = month 0
            const needsReset = benefit.needsReset(date);
            assertFalse(needsReset, `Should not need reset on Jan ${day}`);
        }

        // Test Feb 1 - should need reset
        const feb1 = new Date(2024, 1, 1);
        assertTrue(benefit.needsReset(feb1), 'Should need reset on Feb 1');

        // Verify card identifies it for reset
        const benefitsToReset = card.getBenefitsNeedingReset(feb1);
        assertArrayLength(benefitsToReset, 1, 'Card should identify 1 benefit for reset');
    });

    test('Carryover benefit - simulate year boundary', () => {
        const benefit = new Benefit({
            description: 'Carryover $300 credit',
            totalAmount: 300,
            frequency: 'carryover',
            isCarryover: true,
            earnedInstances: [
                { earnedDate: '2023-06-15', usedAmount: 100 }
            ]
        });

        // Test last days of 2024 - should be active
        for (let day = 28; day <= 31; day++) {
            const date = new Date(2024, 11, day); // December
            assertTrue(benefit.hasActiveCarryoverInstances(date), `Should be active on Dec ${day}, 2024`);
            assertEquals(benefit.getTotalCarryoverRemaining(date), 200, `Should have $200 on Dec ${day}`);
        }

        // Test first days of 2025 - should be expired
        for (let day = 1; day <= 5; day++) {
            const date = new Date(2025, 0, day); // January
            assertFalse(benefit.hasActiveCarryoverInstances(date), `Should be expired on Jan ${day}, 2025`);
            assertEquals(benefit.getTotalCarryoverRemaining(date), 0, `Should have $0 on Jan ${day}, 2025`);
        }
    });

    test('Multiple benefits - identify correct items for reset on specific day', () => {
        const card = new Card({
            name: 'Test Card',
            anniversaryDate: '2020-01-15',
            benefits: [
                {
                    description: 'Monthly credit',
                    totalAmount: 50,
                    frequency: 'monthly',
                    resetType: 'calendar',
                    lastReset: '2024-01-01'
                },
                {
                    description: 'Quarterly credit',
                    totalAmount: 100,
                    frequency: 'quarterly',
                    resetType: 'calendar',
                    lastReset: '2024-01-01'
                },
                {
                    description: 'Annual credit',
                    totalAmount: 300,
                    frequency: 'annual',
                    resetType: 'calendar',
                    lastReset: '2024-01-01'
                }
            ]
        });

        // On Feb 1, only monthly should reset
        const feb1 = new Date(2024, 1, 1);
        let toReset = card.getBenefitsNeedingReset(feb1);
        assertArrayLength(toReset, 1, 'Only monthly should reset on Feb 1');
        assertEquals(toReset[0].frequency, 'monthly', 'Should be monthly benefit');

        // On Apr 1, monthly and quarterly should reset
        const apr1 = new Date(2024, 3, 1);
        toReset = card.getBenefitsNeedingReset(apr1);
        assertArrayLength(toReset, 2, 'Monthly and quarterly should reset on Apr 1');

        // On Jan 1 next year, all should reset
        const jan1_2025 = new Date(2025, 0, 1);
        // Need to simulate that they were reset during the year
        card.benefits[0].reset(new Date(2024, 1, 1)); // Feb
        card.benefits[1].reset(new Date(2024, 3, 1)); // Apr
        toReset = card.getBenefitsNeedingReset(jan1_2025);
        assertArrayLength(toReset, 3, 'All should reset on Jan 1, 2025');
    });
});

// Test Suite 6: Temporarily Declining Reset
runner.suite('Declining Reset - Data Preservation', ({ test }) => {
    test('Benefit data preserved when reset is not performed', () => {
        const benefit = new Benefit({
            description: 'Monthly $50 credit',
            totalAmount: 50,
            usedAmount: 30,
            frequency: 'monthly',
            resetType: 'calendar',
            lastReset: '2024-01-01'
        });

        // User has used $30 of $50
        assertEquals(benefit.usedAmount, 30, 'Should have $30 used');
        assertEquals(benefit.getRemainingAmount(), 20, 'Should have $20 remaining');

        // Time passes, benefit needs reset
        const feb1 = new Date(2024, 1, 1);
        assertTrue(benefit.needsReset(feb1), 'Should need reset');

        // User declines reset - data should remain unchanged
        // (We simply don't call benefit.reset())

        // Verify old data is preserved
        assertEquals(benefit.usedAmount, 30, 'Used amount should be preserved');
        assertEquals(benefit.lastReset, '2024-01-01', 'Last reset date should be preserved');
        assertEquals(benefit.getRemainingAmount(), 20, 'Remaining amount should be preserved');
    });

    test('Carryover instances preserved when not used', () => {
        const benefit = new Benefit({
            description: 'Carryover $300 credit',
            totalAmount: 300,
            frequency: 'carryover',
            isCarryover: true,
            earnedInstances: [
                { earnedDate: '2023-06-15', usedAmount: 50 },
                { earnedDate: '2024-06-15', usedAmount: 100 }
            ]
        });

        // Verify instances exist
        assertArrayLength(benefit.earnedInstances, 2, 'Should have 2 instances');
        assertEquals(benefit.earnedInstances[0].usedAmount, 50, 'First instance should have $50 used');
        assertEquals(benefit.earnedInstances[1].usedAmount, 100, 'Second instance should have $100 used');

        // Time passes - even though 2023 instance will expire soon, it's not deleted
        const date = new Date('2024-12-31');
        
        // Check that both instances still exist
        assertArrayLength(benefit.earnedInstances, 2, 'Both instances should still exist');
        
        // Active instances only include non-expired ones
        const activeInstances = benefit.getActiveCarryoverInstances(date);
        assertArrayLength(activeInstances, 2, 'Both should still be active on Dec 31, 2024');

        // After expiry, expired instances are filtered out by getActiveCarryoverInstances
        // but the data itself is not deleted from earnedInstances array
        const dateAfterExpiry = new Date('2025-01-02');
        const activeAfterExpiry = benefit.getActiveCarryoverInstances(dateAfterExpiry);
        assertArrayLength(activeAfterExpiry, 1, 'Only 2024 instance should be active after 2023 expiry');
        
        // But the raw data is still there
        assertArrayLength(benefit.earnedInstances, 2, 'Raw data should still have 2 instances');
    });

    test('Card with multiple benefits - selective reset', () => {
        const card = new Card({
            name: 'Test Card',
            anniversaryDate: '2020-01-15',
            benefits: [
                {
                    id: 'benefit1',
                    description: 'Monthly credit',
                    totalAmount: 50,
                    usedAmount: 40,
                    frequency: 'monthly',
                    resetType: 'calendar',
                    lastReset: '2024-01-01'
                },
                {
                    id: 'benefit2',
                    description: 'Quarterly credit',
                    totalAmount: 100,
                    usedAmount: 80,
                    frequency: 'quarterly',
                    resetType: 'calendar',
                    lastReset: '2024-01-01'
                }
            ]
        });

        const feb1 = new Date(2024, 1, 1);
        
        // Get benefits needing reset
        const toReset = card.getBenefitsNeedingReset(feb1);
        assertArrayLength(toReset, 1, 'Only monthly should need reset');

        // User chooses to reset the monthly benefit
        const benefit1 = card.findBenefit('benefit1');
        const benefit2 = card.findBenefit('benefit2');
        
        benefit1.reset(feb1);

        // Verify benefit1 was reset
        assertEquals(benefit1.usedAmount, 0, 'Monthly benefit should be reset');
        assertEquals(benefit1.lastReset, feb1.toISOString(), 'Last reset should be updated');

        // Verify benefit2 was NOT reset
        assertEquals(benefit2.usedAmount, 80, 'Quarterly benefit should not be reset');
        assertEquals(benefit2.lastReset, '2024-01-01', 'Quarterly last reset should be unchanged');
    });
});

// Test Suite 7: Expiring Soon Detection
runner.suite('Expiring Soon Detection', ({ test }) => {
    test('Detect benefits expiring within N days', () => {
        const card = new Card({
            name: 'Test Card',
            anniversaryDate: '2020-01-15',
            benefits: [
                {
                    description: 'Monthly credit',
                    totalAmount: 50,
                    frequency: 'monthly',
                    resetType: 'calendar',
                    lastReset: '2024-01-01'
                }
            ]
        });

        const currentDate = new Date('2024-01-25');
        
        // Should expire within 7 days (resets Feb 1 = 7 days away)
        const expiring7 = card.getBenefitsExpiringWithin(currentDate, 7);
        assertArrayLength(expiring7, 1, 'Should find 1 benefit expiring in 7 days');

        // Should expire within 30 days
        const expiring30 = card.getBenefitsExpiringWithin(currentDate, 30);
        assertArrayLength(expiring30, 1, 'Should find 1 benefit expiring in 30 days');

        // Should NOT expire within 5 days
        const expiring5 = card.getBenefitsExpiringWithin(currentDate, 5);
        assertArrayLength(expiring5, 0, 'Should find 0 benefits expiring in 5 days');
    });

    test('Detect carryover instances expiring soon', () => {
        const benefit = new Benefit({
            description: 'Carryover $300 credit',
            totalAmount: 300,
            frequency: 'carryover',
            isCarryover: true,
            earnedInstances: [
                { earnedDate: '2023-06-15', usedAmount: 100 }
            ]
        });

        // Test on Dec 15, 2024 - expires Dec 31 (16 days away)
        const currentDate = new Date('2024-12-15');
        
        const expiring30 = benefit.getExpiringCarryoverInstances(currentDate, 30);
        assertArrayLength(expiring30, 1, 'Should find 1 instance expiring in 30 days');

        const expiring20 = benefit.getExpiringCarryoverInstances(currentDate, 20);
        assertArrayLength(expiring20, 1, 'Should find 1 instance expiring in 20 days');

        const expiring10 = benefit.getExpiringCarryoverInstances(currentDate, 10);
        assertArrayLength(expiring10, 0, 'Should find 0 instances expiring in 10 days');
    });
});

// Run all tests
runner.run().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});
