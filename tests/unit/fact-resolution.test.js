// fact-resolution.test.js - Unit tests for fact resolution functionality

import test from 'ava';
import { runFactResolvers } from '../../loadFromYaml.js';
import { 
    allMockResolvers,
    createMockResolver,
    createConditionalMockResolver,
    createFailingMockResolver
} from '../scenarios/test-resolvers/mockResolvers.js';

test('runFactResolvers - all true resolvers', async t => {
    const resolvers = {
        Fact1: () => true,
        Fact2: () => true,
        Fact3: () => true
    };
    
    const factMap = await runFactResolvers(resolvers);
    
    t.is(factMap.Fact1, true);
    t.is(factMap.Fact2, true);
    t.is(factMap.Fact3, true);
    t.is(Object.keys(factMap).length, 3);
});

test('runFactResolvers - mixed boolean results', async t => {
    const resolvers = {
        TrueFact: () => true,
        FalseFact: () => false,
        TruthyFact: () => 'truthy string',
        FalsyFact: () => '',
        NumberTrueFact: () => 1,
        NumberFalseFact: () => 0,
        NullFact: () => null,
        UndefinedFact: () => undefined
    };
    
    const factMap = await runFactResolvers(resolvers);
    
    t.is(factMap.TrueFact, true);
    t.is(factMap.FalseFact, false);
    t.is(factMap.TruthyFact, true);
    t.is(factMap.FalsyFact, false);
    t.is(factMap.NumberTrueFact, true);
    t.is(factMap.NumberFalseFact, false);
    t.is(factMap.NullFact, false);
    t.is(factMap.UndefinedFact, false);
});

test('runFactResolvers - error handling', async t => {
    const resolvers = {
        GoodFact: () => true,
        ErrorFact: () => { throw new Error('Test error'); },
        AnotherGoodFact: () => false
    };
    
    const factMap = await runFactResolvers(resolvers);
    
    t.is(factMap.GoodFact, true);
    t.is(factMap.ErrorFact, false); // Should be false due to error
    t.is(factMap.AnotherGoodFact, false);
});

test('runFactResolvers - non-function values', async t => {
    const resolvers = {
        BooleanTrue: true,
        BooleanFalse: false,
        String: 'hello',
        EmptyString: '',
        Number: 42,
        Zero: 0,
        Object: { key: 'value' },
        Array: [1, 2, 3],
        EmptyArray: [],
        Null: null,
        Undefined: undefined
    };
    
    const factMap = await runFactResolvers(resolvers);
    
    t.is(factMap.BooleanTrue, true);
    t.is(factMap.BooleanFalse, false);
    t.is(factMap.String, true);
    t.is(factMap.EmptyString, false);
    t.is(factMap.Number, true);
    t.is(factMap.Zero, false);
    t.is(factMap.Object, true);
    t.is(factMap.Array, true);
    t.is(factMap.EmptyArray, true);
    t.is(factMap.Null, false);
    t.is(factMap.Undefined, false);
});

test('runFactResolvers - empty resolver object', async t => {
    const factMap = await runFactResolvers({});
    
    t.is(Object.keys(factMap).length, 0);
});

test('runFactResolvers - mock resolvers integration', async t => {
    const factMap = await runFactResolvers(allMockResolvers);
    
    t.true(Object.keys(factMap).length > 0);
    t.true('UserWantsEuropeanFlight' in factMap);
    t.true('SystemHealthy' in factMap);
    t.true('CustomerIsVIP' in factMap);
    t.true('IsBusinessHours' in factMap);
});

test('createMockResolver - static value', t => {
    const trueResolver = createMockResolver(true);
    const falseResolver = createMockResolver(false);
    const stringResolver = createMockResolver('test');
    
    t.is(trueResolver(), true);
    t.is(falseResolver(), false);
    t.is(stringResolver(), 'test');
});

test('createConditionalMockResolver - dynamic condition', t => {
    let condition = true;
    const resolver = createConditionalMockResolver(() => condition);
    
    t.is(resolver(), true);
    
    condition = false;
    t.is(resolver(), false);
});

test('createFailingMockResolver - error throwing', t => {
    const errorResolver = createFailingMockResolver('Custom error message');
    
    t.throws(() => errorResolver(), { instanceOf: Error });
});

test('runFactResolvers - mixed resolver types', async t => {
    const resolvers = {
        StaticTrue: true,
        StaticFalse: false,
        FunctionTrue: () => true,
        FunctionFalse: () => false,
        ErrorFunction: createFailingMockResolver('Test error'),
        ConditionalFunction: createConditionalMockResolver(() => true)
    };
    
    const factMap = await runFactResolvers(resolvers);
    
    t.is(factMap.StaticTrue, true);
    t.is(factMap.StaticFalse, false);
    t.is(factMap.FunctionTrue, true);
    t.is(factMap.FunctionFalse, false);
    t.is(factMap.ErrorFunction, false);
    t.is(factMap.ConditionalFunction, true);
});

test('runFactResolvers - async function handling', async t => {
    const resolvers = {
        AsyncTrue: async () => true,
        AsyncFalse: async () => false,
        AsyncError: async () => { throw new Error('Async error'); }
    };
    
    const factMap = await runFactResolvers(resolvers);
    
    // runFactResolvers should handle async functions by properly awaiting them
    t.is(factMap.AsyncTrue, true);
    t.is(factMap.AsyncFalse, false);
    t.is(factMap.AsyncError, false);
});