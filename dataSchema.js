(function (global) {
    const BenefitSchema = {
        type: 'object',
        required: ['id', 'description', 'totalAmount', 'frequency'],
        properties: {
            id: { type: 'string' },
            description: { type: 'string' },
            totalAmount: { type: 'number' },
            usedAmount: { type: 'number', nullable: true },
            frequency: {
                type: 'string',
                enum: [
                    'monthly',
                    'quarterly',
                    'biannual',
                    'annual',
                    'every-4-years',
                    'one-time',
                    'carryover'
                ]
            },
            resetType: { type: 'string', nullable: true },
            lastReset: { type: 'string', nullable: true },
            autoClaim: { type: 'boolean', nullable: true },
            autoClaimEndDate: { type: 'string', nullable: true },
            ignored: { type: 'boolean', nullable: true },
            ignoredEndDate: { type: 'string', nullable: true },
            expiryDate: { type: 'string', nullable: true },
            isCarryover: { type: 'boolean', nullable: true },
            earnedInstances: {
                type: 'array',
                nullable: true,
                items: {
                    type: 'object',
                    required: ['earnedDate', 'usedAmount'],
                    properties: {
                        earnedDate: { type: 'string' },
                        usedAmount: { type: 'number' }
                    }
                }
            },
            lastEarnReset: { type: 'string', nullable: true },
            requiredMinimumSpendId: { type: 'string', nullable: true }
        }
    };

    const MinimumSpendSchema = {
        type: 'object',
        required: ['id', 'description', 'targetAmount', 'currentAmount', 'frequency'],
        properties: {
            id: { type: 'string' },
            description: { type: 'string' },
            targetAmount: { type: 'number' },
            currentAmount: { type: 'number' },
            frequency: { type: 'string' },
            resetType: { type: 'string', nullable: true },
            deadline: { type: 'string', nullable: true },
            lastReset: { type: 'string', nullable: true },
            isMet: { type: 'boolean', nullable: true },
            metDate: { type: 'string', nullable: true },
            ignored: { type: 'boolean', nullable: true },
            ignoredEndDate: { type: 'string', nullable: true }
        }
    };

    const CardSchema = {
        type: 'object',
        required: ['id', 'name', 'anniversaryDate', 'benefits', 'minimumSpends'],
        properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            anniversaryDate: { type: 'string' },
            benefits: {
                type: 'array',
                items: BenefitSchema
            },
            minimumSpends: {
                type: 'array',
                items: MinimumSpendSchema
            }
        }
    };

    const DATA_SCHEMA = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: 'CardBenefitsData',
        version: '1.0.0',
        type: 'array',
        items: CardSchema
    };

    function validateAgainstSchema(schema, value, path, errors) {
        const currentPath = path || 'root';
        if (value === null) {
            if (schema.nullable) return;
            errors.push(`${currentPath} should not be null`);
            return;
        }

        if (schema.type === 'array') {
            if (!Array.isArray(value)) {
                errors.push(`${currentPath} should be an array`);
                return;
            }
            if (schema.items) {
                value.forEach((item, idx) => {
                    validateAgainstSchema(schema.items, item, `${currentPath}[${idx}]`, errors);
                });
            }
            return;
        }

        if (schema.type === 'object') {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                errors.push(`${currentPath} should be an object`);
                return;
            }
            if (schema.required) {
                schema.required.forEach((req) => {
                    const propSchema = schema.properties ? schema.properties[req] : null;
                    const isNullable = propSchema && propSchema.nullable;
                    if (value[req] === undefined) {
                        errors.push(`${currentPath}.${req} is required`);
                    } else if (value[req] === null && !isNullable) {
                        errors.push(`${currentPath}.${req} is required and cannot be null`);
                    }
                });
            }
            if (schema.properties) {
                Object.keys(value).forEach((key) => {
                    if (!schema.properties[key]) return;
                    validateAgainstSchema(
                        schema.properties[key],
                        value[key],
                        `${currentPath}.${key}`,
                        errors
                    );
                });
            }
            return;
        }

        if (schema.type === 'number') {
            if (typeof value !== 'number') {
                errors.push(`${currentPath} should be a number`);
            }
            return;
        }

        if (schema.type === 'boolean') {
            if (typeof value !== 'boolean') {
                errors.push(`${currentPath} should be a boolean`);
            }
            return;
        }

        if (schema.type === 'string') {
            if (typeof value !== 'string') {
                errors.push(`${currentPath} should be a string`);
                return;
            }
            if (schema.enum && !schema.enum.includes(value)) {
                errors.push(`${currentPath} should be one of ${schema.enum.join(', ')}`);
            }
        }
    }

    function validateDataAgainstSchema(data) {
        const errors = [];
        validateAgainstSchema(DATA_SCHEMA, data, 'root', errors);
        return { valid: errors.length === 0, errors };
    }

    global.DATA_SCHEMA = DATA_SCHEMA;
    global.validateDataAgainstSchema = validateDataAgainstSchema;
})(typeof window !== 'undefined' ? window : globalThis);
