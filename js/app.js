// ==================== STATE MANAGEMENT ====================
let state = {
    currentFunction: '',
    compiledFunction: null,
    lastResult: null,
    isDarkMode: false
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    loadThemePreference();
    updateModeOptions();
});

function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        document.querySelector('.theme-toggle').textContent = '🌙';
        state.isDarkMode = true;
    }
}

// ==================== THEME TOGGLE ====================
function toggleTheme() {
    state.isDarkMode = !state.isDarkMode;
    document.body.classList.toggle('dark');
    document.querySelector('.theme-toggle').textContent = state.isDarkMode ? '🌙' : '☀️';
    localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
}

// ==================== NUCLEAR-GRADE SAFE EVALUATION ====================
function safeEvaluate(functionString, variables) {
    try {
        // Strategy 1: Direct evaluation
        let result = math.evaluate(functionString, variables);

        // Strategy 2: Handle all possible return types
        if (typeof result === 'number') {
            return result;
        }

        // Strategy 3: If it's a function, try to invoke it
        if (typeof result === 'function') {
            try {
                result = result();
                if (typeof result === 'number') return result;
            } catch (e) {
                // Continue to next strategy
            }
        }

        // Strategy 4: If it's a complex number
        if (result && typeof result === 'object' && 're' in result) {
            return typeof result.re === 'number' ? result.re : Number(result.re);
        }

        // Strategy 5: If it's a math.js type (Unit, BigNumber, Fraction)
        if (result && typeof result.toNumber === 'function') {
            return result.toNumber();
        }

        // Strategy 6: Parse and re-evaluate with explicit scope
        const node = math.parse(functionString);
        const compiled = node.compile();
        result = compiled.evaluate(variables);

        if (typeof result === 'number') {
            return result;
        }

        // Strategy 7: String coercion and parse
        const strResult = String(result);
        const numResult = parseFloat(strResult);
        if (!isNaN(numResult) && isFinite(numResult)) {
            return numResult;
        }

        // Strategy 8: Last resort - try numeric evaluation
        try {
            // Replace variables with their values in the string
            let expr = functionString;
            for (const [varName, varValue] of Object.entries(variables)) {
                const regex = new RegExp('\\b' + varName + '\\b', 'g');
                expr = expr.replace(regex, `(${varValue})`);
            }
            result = math.evaluate(expr);
            if (typeof result === 'number') return result;
            if (typeof result.toNumber === 'function') return result.toNumber();
        } catch (e) {
            // Continue to error
        }

        throw new Error(`Cannot evaluate to number. Got type: ${typeof result}, value: ${result}`);

    } catch (error) {
        throw new Error(`Evaluation failed: ${error.message}`);
    }
}

// ==================== ALTERNATIVE: PURE JAVASCRIPT EVALUATOR ====================
function createJSFunction(mathExpression) {
    // Convert math notation to JavaScript
    let jsExpr = mathExpression
        .replace(/\^/g, '**')
        .replace(/log\(/g, 'Math.log(')
        .replace(/sin\(/g, 'Math.sin(')
        .replace(/cos\(/g, 'Math.cos(')
        .replace(/tan\(/g, 'Math.tan(')
        .replace(/sqrt\(/g, 'Math.sqrt(')
        .replace(/abs\(/g, 'Math.abs(')
        .replace(/exp\(/g, 'Math.exp(')
        .replace(/\be\b/g, 'Math.E');

    try {
        // Create a function that can be called with variables
        return new Function('x', 'y', 'z', `"use strict"; return (${jsExpr});`);
    } catch (e) {
        throw new Error('Cannot create JavaScript function: ' + e.message);
    }
}

function hybridEvaluate(functionString, variables) {
    // Try math.js first (for symbolic capabilities)
    try {
        const result = safeEvaluate(functionString, variables);
        if (typeof result === 'number' && isFinite(result)) {
            return result;
        }
    } catch (e) {
        // Fall through to JavaScript evaluation
    }

    // Fallback to pure JavaScript evaluation
    try {
        const jsFunc = createJSFunction(functionString);
        const result = jsFunc(
            variables.x !== undefined ? variables.x : 0,
            variables.y !== undefined ? variables.y : 0,
            variables.z !== undefined ? variables.z : 0
        );

        if (typeof result === 'number' && isFinite(result)) {
            return result;
        }

        throw new Error('JavaScript evaluation produced non-finite result');
    } catch (e) {
        throw new Error(`Both math.js and JavaScript evaluation failed: ${e.message}`);
    }
}

// ==================== INPUT VALIDATION ====================
function normalizeFunction(input) {
    return input
        .replace(/\s+/g, '')
        .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
        .replace(/\)(\d)/g, ')*$1')
        .replace(/\)([a-zA-Z(])/g, ')*$1');
}

function validateFunction() {
    const input = document.getElementById('functionInput').value.trim();
    const preview = document.getElementById('preview');

    if (!input) {
        preview.textContent = 'Enter a function to begin...';
        preview.className = 'preview-box';
        state.currentFunction = '';
        state.compiledFunction = null;
        return false;
    }

    try {
        const normalized = normalizeFunction(input);

        // Test with multiple evaluation strategies
        let testPassed = false;
        let testResult;

        // Test 1: Try at x=1
        try {
            testResult = hybridEvaluate(normalized, { x: 1, y: 1, z: 1 });
            testPassed = typeof testResult === 'number' && isFinite(testResult);
        } catch (e) {
            // Try another point
        }

        // Test 2: If first test failed, try x=0
        if (!testPassed) {
            try {
                testResult = hybridEvaluate(normalized, { x: 0.5, y: 0.5, z: 0.5 });
                testPassed = typeof testResult === 'number' && isFinite(testResult);
            } catch (e) {
                // Continue
            }
        }

        if (!testPassed) {
            throw new Error('Function cannot be evaluated numerically');
        }

        state.currentFunction = normalized;
        state.compiledFunction = normalized; // Store string, not compiled object

        preview.innerHTML = `<strong>✓</strong> Valid: ${normalized} <span style="opacity:0.6">(test: f(1) = ${testResult.toFixed(4)})</span>`;
        preview.className = 'preview-box valid';
        return true;
    } catch (error) {
        preview.innerHTML = `<strong>⚠</strong> ${error.message}`;
        preview.className = 'preview-box error';
        state.currentFunction = '';
        state.compiledFunction = null;
        return false;
    }
}

// ==================== TEMPLATE INSERTION ====================
function insertTemplate(template) {
    document.getElementById('functionInput').value = template;
    validateFunction();
}

// ==================== SETTING UPDATES ====================
function updatePrecision(value) {
    document.getElementById('precisionValue').textContent = value;
}

function updateResolution(value) {
    document.getElementById('resolutionValue').textContent = value;
}

// ==================== MODE OPTIONS ====================
function updateModeOptions() {
    const mode = document.getElementById('operationMode').value;
    const container = document.getElementById('modeOptions');

    const options = {
        basic: `
            <div class="option-group">
                <label class="option-label">Operation Type</label>
                <select id="basicOp">
                    <option value="derivative">First Derivative</option>
                    <option value="derivative2">Second Derivative</option>
                    <option value="integral">Indefinite Integral</option>
                    <option value="definite">Definite Integral</option>
                </select>
            </div>
            <div class="option-group" id="limitsGroup" style="display:none;">
                <label class="option-label">Lower Limit</label>
                <input type="number" id="lowerLimit" placeholder="0" step="0.1">
                <label class="option-label" style="margin-top:8px;">Upper Limit</label>
                <input type="number" id="upperLimit" placeholder="1" step="0.1">
            </div>
        `,
        advanced: `
            <div class="option-group">
                <label class="option-label">Integration Method</label>
                <select id="integrationMethod">
                    <option value="auto">Auto-detect</option>
                    <option value="substitution">U-Substitution</option>
                    <option value="parts">Integration by Parts</option>
                    <option value="partial">Partial Fractions</option>
                    <option value="trig">Trig Substitution</option>
                </select>
            </div>
            <div class="option-group">
                <label class="option-label">Lower Limit (optional)</label>
                <input type="text" id="advLower" placeholder="Leave empty for indefinite">
                <label class="option-label" style="margin-top:8px;">Upper Limit (optional)</label>
                <input type="text" id="advUpper" placeholder="Leave empty for indefinite">
            </div>
        `,
        differential: `
            <div class="option-group">
                <label class="option-label">Equation Type</label>
                <select id="odeType">
                    <option value="firstOrder">First Order ODE</option>
                    <option value="secondOrder">Second Order ODE</option>
                    <option value="system">System of ODEs</option>
                </select>
            </div>
            <div class="option-group">
                <label class="option-label">Initial Conditions</label>
                <input type="text" id="initialCond" placeholder="e.g., y(0)=1">
            </div>
        `,
        series: `
            <div class="option-group">
                <label class="option-label">Series Type</label>
                <select id="seriesType">
                    <option value="taylor">Taylor Series</option>
                    <option value="maclaurin">Maclaurin Series</option>
                    <option value="power">Power Series</option>
                </select>
            </div>
            <div class="option-group">
                <label class="option-label">Expansion Point (a)</label>
                <input type="number" id="expansionPoint" value="0" step="0.1">
                <label class="option-label" style="margin-top:8px;">Number of Terms</label>
                <input type="number" id="numTerms" value="5" min="1" max="20">
            </div>
        `,
        multivariable: `
            <div class="option-group">
                <label class="option-label">Operation</label>
                <select id="multiOp">
                    <option value="partial">Partial Derivatives</option>
                    <option value="gradient">Gradient Vector</option>
                    <option value="divergence">Divergence</option>
                    <option value="curl">Curl</option>
                    <option value="double">Double Integral</option>
                </select>
            </div>
            <div class="option-group">
                <label class="option-label">Variables (comma-separated)</label>
                <input type="text" id="multiVars" placeholder="x,y">
            </div>
        `
    };

    container.innerHTML = options[mode] || options.basic;
    container.classList.remove('hidden');

    // Add event listener for basic operation change
    if (mode === 'basic') {
        const basicOp = document.getElementById('basicOp');
        basicOp.addEventListener('change', function() {
            const limitsGroup = document.getElementById('limitsGroup');
            limitsGroup.style.display = this.value === 'definite' ? 'block' : 'none';
        });
    }
}

// ==================== MAIN COMPUTE FUNCTION ====================
async function compute() {
    if (!validateFunction()) {
        showAlert('Please enter a valid function first', 'error');
        return;
    }

    const mode = document.getElementById('operationMode').value;
    const computeBtn = document.getElementById('computeBtn');

    // Show loading state
    computeBtn.classList.add('loading');
    computeBtn.innerHTML = '<div class="spinner"></div><span>Computing...</span>';

    try {
        let result;

        switch(mode) {
            case 'basic':
                result = await computeBasic();
                break;
            case 'advanced':
                result = await computeAdvanced();
                break;
            case 'differential':
                result = await computeDifferential();
                break;
            case 'series':
                result = await computeSeries();
                break;
            case 'multivariable':
                result = await computeMultivariable();
                break;
        }

        state.lastResult = result;
        displayResult(result);
        switchTab('results');

    } catch (error) {
        showAlert('Computation error: ' + error.message, 'error');
    } finally {
        computeBtn.classList.remove('loading');
        computeBtn.innerHTML = '<span>🚀</span><span>Compute</span>';
    }
}

// ==================== BASIC CALCULUS ====================
async function computeBasic() {
    const operation = document.getElementById('basicOp').value;

    switch(operation) {
        case 'derivative':
            return computeDerivative(1);
        case 'derivative2':
            return computeDerivative(2);
        case 'integral':
            return computeSymbolicIntegral();
        case 'definite':
            return computeDefiniteIntegral();
    }
}

function computeDerivative(order) {
    try {
        let node = math.parse(state.currentFunction);
        let result = node;

        for (let i = 0; i < order; i++) {
            result = math.derivative(result, 'x');
        }

        const simplified = math.simplify(result);

        return {
            type: order === 1 ? 'derivative' : 'derivative2',
            symbolic: simplified.toString(),
            original: state.currentFunction,
            steps: generateDerivativeSteps(order)
        };
    } catch (error) {
        throw new Error('Unable to compute derivative: ' + error.message);
    }
}

function computeSymbolicIntegral() {
    try {
        // Attempt symbolic integration with Algebrite
        const expr = state.currentFunction
            .replace(/\*/g, ' ')
            .replace(/log/g, 'ln');

        const result = Algebrite.run(`integral(${expr}, x)`);
        const resultStr = String(result);

        // Check if Algebrite actually integrated it
        if (resultStr.includes('integral(') || resultStr === expr) {
            // Try common patterns
            const pattern = tryCommonIntegrals(state.currentFunction);
            if (pattern) {
                return {
                    type: 'integral',
                    symbolic: pattern + ' + C',
                    method: 'Pattern Matching',
                    original: state.currentFunction,
                    steps: generateIntegralSteps('pattern')
                };
            }

            return {
                type: 'integral',
                symbolic: 'Unable to find symbolic integral',
                note: 'Try using definite integral with numerical methods',
                method: 'N/A',
                original: state.currentFunction,
                steps: []
            };
        }

        return {
            type: 'integral',
            symbolic: resultStr + ' + C',
            method: 'Symbolic (Algebrite)',
            original: state.currentFunction,
            steps: generateIntegralSteps('symbolic')
        };
    } catch (error) {
        throw new Error('Integration failed: ' + error.message);
    }
}

function tryCommonIntegrals(func) {
    const patterns = {
        'x': '(x^2)/2',
        'x^2': '(x^3)/3',
        'x^3': '(x^4)/4',
        'sin(x)': '-cos(x)',
        'cos(x)': 'sin(x)',
        'e^x': 'e^x',
        '1/x': 'ln(|x|)',
        'tan(x)': '-ln(|cos(x)|)',
        'sec(x)^2': 'tan(x)',
        '1/sqrt(1-x^2)': 'asin(x)',
        '1/(1+x^2)': 'atan(x)'
    };

    return patterns[func] || null;
}

function computeDefiniteIntegral() {
    const lower = parseFloat(document.getElementById('lowerLimit').value);
    const upper = parseFloat(document.getElementById('upperLimit').value);

    if (isNaN(lower) || isNaN(upper)) {
        throw new Error('Please enter valid numerical limits');
    }

    if (lower >= upper) {
        throw new Error('Lower limit must be less than upper limit');
    }

    const points = parseInt(document.getElementById('resolution').value);
    const n = points % 2 === 0 ? points : points + 1;
    const h = (upper - lower) / n;
    let sum = 0;
    let errors = [];

    try {
        const funcStr = state.currentFunction;

        for (let i = 0; i <= n; i++) {
            const x = lower + i * h;

            let y;
            try {
                y = hybridEvaluate(funcStr, { x: x });
            } catch (evalError) {
                errors.push(`x=${x.toFixed(6)}: ${evalError.message}`);
                continue;
            }

            if (!isFinite(y)) {
                errors.push(`x=${x.toFixed(6)}: non-finite value (${y})`);
                continue;
            }

            // Simpson's rule coefficients
            if (i === 0 || i === n) {
                sum += y;
            } else if (i % 2 === 0) {
                sum += 2 * y;
            } else {
                sum += 4 * y;
            }
        }

        if (errors.length > n * 0.1) {
            throw new Error(`Too many evaluation errors (${errors.length}/${n}). Sample: ${errors[0]}`);
        }

        const result = (h / 3) * sum;
        const precision = parseInt(document.getElementById('precision').value);

        return {
            type: 'definite',
            value: result.toFixed(precision),
            lower: lower,
            upper: upper,
            method: "Simpson's Rule (Hybrid Evaluation)",
            points: n,
            warnings: errors.length > 0 ? `${errors.length} points skipped` : null,
            original: state.currentFunction,
            steps: generateDefiniteSteps(lower, upper, result, n)
        };
    } catch (error) {
        throw new Error('Numerical integration failed: ' + error.message);
    }
}

// ==================== ADVANCED INTEGRATION ====================
async function computeAdvanced() {
    const method = document.getElementById('integrationMethod').value;
    const lower = document.getElementById('advLower').value.trim();
    const upper = document.getElementById('advUpper').value.trim();

    // If limits provided, do numerical
    if (lower && upper) {
        const lowerVal = parseFloat(lower);
        const upperVal = parseFloat(upper);

        if (isNaN(lowerVal) || isNaN(upperVal)) {
            throw new Error('Invalid numerical limits');
        }

        return computeDefiniteWithMethod(lowerVal, upperVal, method);
    }

    // Otherwise attempt symbolic with method hint
    return computeSymbolicWithMethod(method);
}

function computeSymbolicWithMethod(method) {
    try {
        const expr = state.currentFunction.replace(/\*/g, ' ').replace(/log/g, 'ln');
        const result = Algebrite.run(`integral(${expr}, x)`);
        const resultStr = String(result);

        if (resultStr.includes('integral(')) {
            return {
                type: 'advanced',
                symbolic: 'Unable to find closed form',
                method: method,
                suggestion: getMethodSuggestion(method),
                original: state.currentFunction,
                steps: []
            };
        }

        return {
            type: 'advanced',
            symbolic: resultStr + ' + C',
            method: method,
            original: state.currentFunction,
            steps: generateAdvancedSteps(method)
        };
    } catch (error) {
        throw new Error('Advanced integration failed: ' + error.message);
    }
}

function computeDefiniteWithMethod(lower, upper, method) {
    const points = parseInt(document.getElementById('resolution').value);
    const n = points % 2 === 0 ? points : points + 1;
    const h = (upper - lower) / n;
    let sum = 0;
    let errors = [];

    try {
        const funcStr = state.currentFunction;

        for (let i = 0; i <= n; i++) {
            const x = lower + i * h;

            let y;
            try {
                y = hybridEvaluate(funcStr, { x: x });
            } catch (evalError) {
                errors.push(`x=${x.toFixed(6)}`);
                continue;
            }

            if (!isFinite(y)) {
                errors.push(`x=${x.toFixed(6)}: infinity`);
                continue;
            }

            if (i === 0 || i === n) {
                sum += y;
            } else if (i % 2 === 0) {
                sum += 2 * y;
            } else {
                sum += 4 * y;
            }
        }

        if (errors.length > n * 0.1) {
            throw new Error(`Too many discontinuities (${errors.length} points failed)`);
        }

        const result = (h / 3) * sum;
        const precision = parseInt(document.getElementById('precision').value);

        return {
            type: 'advanced',
            value: result.toFixed(precision),
            lower: lower,
            upper: upper,
            method: method + " (Hybrid Numerical)",
            points: n,
            warnings: errors.length > 0 ? `${errors.length} points skipped due to discontinuities` : null,
            original: state.currentFunction,
            steps: generateAdvancedSteps(method, true)
        };
    } catch (error) {
        throw new Error('Advanced integration failed: ' + error.message);
    }
}

function getMethodSuggestion(method) {
    const suggestions = {
        'substitution': 'Try identifying u = g(x) where du appears in the integrand',
        'parts': 'Use ∫u dv = uv - ∫v du. Choose u using LIATE rule',
        'partial': 'Decompose rational function into partial fractions',
        'trig': 'Use trigonometric identities or substitutions'
    };
    return suggestions[method] || 'Consider numerical methods';
}

// ==================== DIFFERENTIAL EQUATIONS ====================
async function computeDifferential() {
    const odeType = document.getElementById('odeType').value;
    const initialCond = document.getElementById('initialCond').value.trim();

    return {
        type: 'differential',
        odeType: odeType,
        equation: state.currentFunction,
        solution: 'Analytical ODE solver not fully implemented',
        note: 'For complete ODE solutions, consider using specialized software',
        initialConditions: initialCond || 'None specified',
        steps: generateODESteps(odeType)
    };
}

// ==================== SERIES EXPANSION ====================
async function computeSeries() {
    const seriesType = document.getElementById('seriesType').value;
    const point = parseFloat(document.getElementById('expansionPoint').value) || 0;
    const terms = parseInt(document.getElementById('numTerms').value) || 5;

    try {
        const expr = state.currentFunction.replace(/\*/g, ' ').replace(/log/g, 'ln');

        // Use Algebrite for Taylor series
        const seriesExpr = `taylor(${expr}, x, ${point}, ${terms})`;
        const result = Algebrite.run(seriesExpr);
        const resultStr = String(result);

        return {
            type: 'series',
            seriesType: seriesType,
            expansion: resultStr,
            point: point,
            terms: terms,
            original: state.currentFunction,
            steps: generateSeriesSteps(seriesType, point, terms)
        };
    } catch (error) {
        // Fallback: compute derivatives manually
        return computeSeriesNumerical(point, terms);
    }
}

function computeSeriesNumerical(point, terms) {
    try {
        const seriesTerms = [];
        let node = math.parse(state.currentFunction);

        for (let n = 0; n < terms; n++) {
            const derivative = n === 0 ? node : math.derivative(node, 'x');
            const value = derivative.evaluate({ x: point });
            const factorial = math.factorial(n);
            const coefficient = value / factorial;

            if (Math.abs(coefficient) > 1e-10) {
                seriesTerms.push({
                    order: n,
                    coefficient: coefficient,
                    term: `${coefficient.toFixed(4)} * (x - ${point})^${n}`
                });
            }

            if (n < terms - 1) {
                node = derivative;
            }
        }

        return {
            type: 'series',
            seriesType: 'taylor',
            terms: seriesTerms,
            point: point,
            numTerms: terms,
            original: state.currentFunction,
            steps: generateSeriesSteps('taylor', point, terms)
        };
    } catch (error) {
        throw new Error('Series computation failed: ' + error.message);
    }
}

// ==================== MULTIVARIABLE CALCULUS ====================
async function computeMultivariable() {
    const operation = document.getElementById('multiOp').value;
    const varsInput = document.getElementById('multiVars').value;
    const vars = varsInput.split(',').map(v => v.trim()).filter(v => v);

    if (vars.length < 2) {
        throw new Error('Please specify at least 2 variables (e.g., x,y)');
    }

    try {
        switch(operation) {
            case 'partial':
                return computePartialDerivatives(vars);
            case 'gradient':
                return computeGradient(vars);
            case 'divergence':
                return computeDivergence(vars);
            case 'curl':
                return computeCurl(vars);
            case 'double':
                return computeDoubleIntegral(vars);
            default:
                throw new Error('Unknown operation');
        }
    } catch (error) {
        throw new Error('Multi-variable computation failed: ' + error.message);
    }
}

function computePartialDerivatives(vars) {
    try {
        const node = math.parse(state.currentFunction);
        const partials = {};

        for (const v of vars) {
            try {
                const partial = math.derivative(node, v);
                partials[v] = math.simplify(partial).toString();
            } catch (e) {
                partials[v] = `Unable to compute ∂/∂${v}`;
            }
        }

        return {
            type: 'multivariable',
            operation: 'Partial Derivatives',
            variables: vars,
            result: partials,
            original: state.currentFunction,
            steps: generateMultivariableSteps('partial', vars)
        };
    } catch (error) {
        throw new Error('Partial derivative computation failed: ' + error.message);
    }
}

function computeGradient(vars) {
    try {
        const node = math.parse(state.currentFunction);
        const gradient = [];

        for (const v of vars) {
            try {
                const partial = math.derivative(node, v);
                gradient.push(math.simplify(partial).toString());
            } catch (e) {
                gradient.push('0');
            }
        }

        return {
            type: 'multivariable',
            operation: 'Gradient Vector',
            variables: vars,
            result: gradient,
            notation: `∇f = (${gradient.join(', ')})`,
            original: state.currentFunction,
            steps: generateMultivariableSteps('gradient', vars)
        };
    } catch (error) {
        throw new Error('Gradient computation failed: ' + error.message);
    }
}

function computeDivergence(vars) {
    // For divergence, we need a vector field
    // Treat the function as one component and compute symbolic divergence
    try {
        const node = math.parse(state.currentFunction);
        let divergence = 0;

        for (const v of vars) {
            try {
                const partial = math.derivative(node, v);
                const simplified = math.simplify(partial);
                divergence = `${divergence} + ∂(${state.currentFunction})/∂${v}`;
            } catch (e) {
                // Continue
            }
        }

        return {
            type: 'multivariable',
            operation: 'Divergence',
            variables: vars,
            result: `Div F = ${divergence}`,
            note: 'For full divergence, provide vector field components',
            original: state.currentFunction,
            steps: generateMultivariableSteps('divergence', vars)
        };
    } catch (error) {
        throw new Error('Divergence computation failed: ' + error.message);
    }
}

function computeCurl(vars) {
    if (vars.length !== 2 && vars.length !== 3) {
        throw new Error('Curl requires 2D or 3D vector field');
    }

    try {
        const node = math.parse(state.currentFunction);

        if (vars.length === 2) {
            // 2D curl (scalar vorticity)
            const dx = math.derivative(node, vars[0]);
            const dy = math.derivative(node, vars[1]);

            return {
                type: 'multivariable',
                operation: 'Curl (2D Vorticity)',
                variables: vars,
                result: `∂f/∂${vars[1]} - ∂f/∂${vars[0]}`,
                note: '2D curl computed as scalar vorticity',
                original: state.currentFunction,
                steps: generateMultivariableSteps('curl', vars)
            };
        } else {
            return {
                type: 'multivariable',
                operation: 'Curl (3D)',
                variables: vars,
                result: 'Full 3D curl requires vector field components',
                note: 'Provide separate Fx, Fy, Fz components for complete 3D curl',
                original: state.currentFunction,
                steps: generateMultivariableSteps('curl', vars)
            };
        }
    } catch (error) {
        throw new Error('Curl computation failed: ' + error.message);
    }
}

function computeDoubleIntegral(vars) {
    if (vars.length < 2) {
        throw new Error('Double integral requires at least 2 variables');
    }

    // For demonstration, compute a simple rectangular region
    return {
        type: 'multivariable',
        operation: 'Double Integral',
        variables: vars,
        result: 'Numerical double integration requires region specification',
        note: 'For rectangular regions, use iterated single integrals',
        suggestion: 'First integrate with respect to one variable, then the other',
        original: state.currentFunction,
        steps: generateMultivariableSteps('double', vars)
    };
}

// ==================== STEP GENERATION ====================
function generateDerivativeSteps(order) {
    return [
        { num: 1, title: 'Apply differentiation rules', content: `Taking the ${order === 1 ? 'first' : 'second'} derivative of f(x) = ${state.currentFunction}` },
        { num: 2, title: 'Use power rule, chain rule, product rule as needed', content: 'Apply appropriate differentiation techniques' },
        { num: 3, title: 'Simplify result', content: 'Combine like terms and simplify the expression' }
    ];
}

function generateIntegralSteps(method) {
    if (method === 'symbolic') {
        return [
            { num: 1, title: 'Identify integration pattern', content: 'Analyze the function structure' },
            { num: 2, title: 'Apply integration rules', content: 'Use appropriate integration techniques' },
            { num: 3, title: 'Add constant of integration', content: 'Remember to add +C for indefinite integrals' }
        ];
    }
    return [
        { num: 1, title: 'Match pattern', content: 'Found matching integral pattern in lookup table' },
        { num: 2, title: 'Apply formula', content: 'Use standard integral formula' },
        { num: 3, title: 'Add constant', content: 'Add +C for indefinite integral' }
    ];
}

function generateDefiniteSteps(lower, upper, result, points) {
    return [
        { num: 1, title: 'Set up definite integral', content: `∫[${lower}, ${upper}] f(x) dx` },
        { num: 2, title: 'Apply Simpson\'s Rule', content: `Using ${points} sample points for numerical integration` },
        { num: 3, title: 'Compute weighted sum', content: 'Calculate weighted sum of function values at sample points' },
        { num: 4, title: 'Final result', content: `Result ≈ ${result}` }
    ];
}

function generateAdvancedSteps(method, isNumerical = false) {
    const base = [
        { num: 1, title: `Method: ${method}`, content: `Using ${method} integration technique` },
        { num: 2, title: 'Apply method', content: isNumerical ? 'Numerical evaluation using Simpson\'s Rule' : 'Symbolic integration attempt' },
        { num: 3, title: 'Simplify', content: 'Simplify and verify the result' }
    ];
    return base;
}

function generateODESteps(odeType) {
    return [
        { num: 1, title: `${odeType} ODE`, content: 'Identify the order and type of differential equation' },
        { num: 2, title: 'Solution method', content: 'For complete ODE solutions, specialized solvers are recommended' },
        { num: 3, title: 'Note', content: 'This tool provides basic ODE analysis. Use dedicated ODE solvers for complete solutions' }
    ];
}

function generateSeriesSteps(seriesType, point, terms) {
    return [
        { num: 1, title: `${seriesType} expansion`, content: `Expanding around point a = ${point}` },
        { num: 2, title: 'Compute derivatives', content: `Computing first ${terms} derivatives at x = ${point}` },
        { num: 3, title: 'Build series', content: 'Construct series using Taylor/Maclaurin formula' },
        { num: 4, title: 'Result', content: `Series with ${terms} terms` }
    ];
}

function generateMultivariableSteps(operation, vars) {
    return [
        { num: 1, title: `${operation} computation`, content: `Operating on function with variables: ${vars.join(', ')}` },
        { num: 2, title: 'Multi-variable calculus', content: 'Requires specialized implementation for complete solutions' },
        { num: 3, title: 'Note', content: 'Partial derivatives and gradients can be approximated numerically' }
    ];
}

// ==================== DISPLAY RESULTS ====================
function displayResult(result) {
    const container = document.getElementById('results');
    const stepsContainer = document.getElementById('steps');

    let html = '';

    // Build result card based on type
    if (result.type === 'derivative' || result.type === 'derivative2') {
        html += `
            <div class="result-card">
                <div class="result-title">
                    <div class="result-icon">∂</div>
                    <span>${result.type === 'derivative' ? 'First' : 'Second'} Derivative</span>
                </div>
                <div class="result-content">
                    <strong>${result.type === 'derivative' ? "f'(x)" : "f''(x)"} =</strong> ${escapeHtml(result.symbolic)}
                </div>
                <div class="result-meta">
                    Original function: ${escapeHtml(result.original)}
                </div>
            </div>
        `;
    } else if (result.type === 'integral') {
        html += `
            <div class="result-card">
                <div class="result-title">
                    <div class="result-icon">∫</div>
                    <span>Indefinite Integral</span>
                </div>
                <div class="result-content">
                    <strong>∫ f(x) dx =</strong> ${escapeHtml(result.symbolic)}
                </div>
                <div class="result-meta">
                    Method: ${result.method}<br>
                    ${result.note ? result.note : ''}
                </div>
            </div>
        `;
    } else if (result.type === 'definite') {
        html += `
            <div class="result-card">
                <div class="result-title">
                    <div class="result-icon">∫</div>
                    <span>Definite Integral</span>
                </div>
                <div class="result-content">
                    <strong>∫<sub>${result.lower}</sub><sup>${result.upper}</sup> f(x) dx ≈</strong> ${result.value}
                </div>
                <div class="result-meta">
                    Method: ${result.method} (${result.points} points)<br>
                    Original: ${escapeHtml(result.original)}
                </div>
            </div>
        `;
    } else if (result.type === 'advanced') {
        html += `
            <div class="result-card">
                <div class="result-title">
                    <div class="result-icon">∫</div>
                    <span>Advanced Integration</span>
                </div>
                <div class="result-content">
                    ${result.value ? `<strong>Result ≈</strong> ${result.value}` : `<strong>Result:</strong> ${escapeHtml(result.symbolic)}`}
                </div>
                <div class="result-meta">
                    Method: ${result.method}<br>
                    ${result.suggestion ? result.suggestion : ''}
                    ${result.lower !== undefined ? `Limits: [${result.lower}, ${result.upper}]` : ''}
                </div>
            </div>
        `;
    } else if (result.type === 'series') {
        if (result.expansion) {
            html += `
                <div class="result-card">
                    <div class="result-title">
                        <div class="result-icon">Σ</div>
                        <span>Series Expansion</span>
                    </div>
                    <div class="result-content">
                        ${escapeHtml(result.expansion)}
                    </div>
                    <div class="result-meta">
                        Type: ${result.seriesType}<br>
                        Expansion point: x = ${result.point}<br>
                        Terms: ${result.terms}
                    </div>
                </div>
            `;
        } else if (result.terms) {
            html += `
                <div class="result-card">
                    <div class="result-title">
                        <div class="result-icon">Σ</div>
                        <span>Series Expansion</span>
                    </div>
                    <div class="result-content">
                        ${result.terms.map(t => escapeHtml(t.term)).join(' + ')}
                    </div>
                    <div class="result-meta">
                        Expansion point: x = ${result.point}<br>
                        Terms computed: ${result.numTerms}
                    </div>
                </div>
            `;
        }
    } else if (result.type === 'differential') {
        html += `
            <div class="result-card">
                <div class="result-title">
                    <div class="result-icon">∂</div>
                    <span>Differential Equation</span>
                </div>
                <div class="result-content">
                    ${escapeHtml(result.solution)}
                </div>
                <div class="result-meta">
                    Type: ${result.odeType}<br>
                    Initial conditions: ${result.initialConditions}<br>
                    ${result.note}
                </div>
            </div>
        `;
    } else if (result.type === 'multivariable') {
        html += `
            <div class="result-card">
                <div class="result-title">
                    <div class="result-icon">∇</div>
                    <span>${result.operation}</span>
                </div>
                <div class="result-content">
        `;

        if (result.operation === 'Partial Derivatives' && typeof result.result === 'object') {
            html += '<strong>Partial Derivatives:</strong><br><br>';
            for (const [varName, derivative] of Object.entries(result.result)) {
                html += `∂f/∂${varName} = ${escapeHtml(derivative)}<br><br>`;
            }
        } else if (result.operation === 'Gradient Vector' && Array.isArray(result.result)) {
            html += `<strong>${result.notation || 'Gradient'}</strong><br><br>`;
            result.result.forEach((component, idx) => {
                html += `Component ${idx + 1}: ${escapeHtml(component)}<br>`;
            });
        } else {
            html += escapeHtml(String(result.result));
        }

        html += `
                </div>
                <div class="result-meta">
                    Variables: ${result.variables.join(', ')}<br>
                    ${result.note ? result.note + '<br>' : ''}
                    ${result.suggestion ? result.suggestion : ''}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;

    // Display steps
    displaySteps(stepsContainer, result.steps || []);
}

function displaySteps(container, steps) {
    if (!steps || steps.length === 0) {
        container.classList.remove('show-timeline');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📖</div>
                <h3>No detailed steps available</h3>
                <p>Step-by-step solutions not available for this computation</p>
            </div>
        `;
        return;
    }

    container.classList.add('show-timeline');
    let html = '';
    steps.forEach((step, index) => {
        html += `
            <div class="step-card" style="--delay:${index * 80}ms">
                <div class="step-header">
                    <div class="step-number">${step.num}</div>
                    <div class="step-title">${step.title}</div>
                </div>
                <div class="step-content">${step.content}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ==================== PLOTTING WITH LIBRARY VALIDATION ====================
function checkPlotlyAvailable() {
    if (typeof Plotly === 'undefined') {
        throw new Error('Plotly library not loaded. Please refresh the page.');
    }
    return true;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');

    if (tabName === 'plot' && state.currentFunction) {
        plot2D();
    } else if (tabName === 'plot3d' && state.currentFunction) {
        plot3D();
    }
}

function plot2D() {
    if (!state.currentFunction) {
        showAlert('Please enter a valid function first', 'error');
        return;
    }

    const plotDiv = document.getElementById('plot2d');

    try {
        checkPlotlyAvailable();

        const resolution = parseInt(document.getElementById('resolution').value);
        const xMin = -10;
        const xMax = 10;
        const step = (xMax - xMin) / resolution;

        const xValues = [];
        const yValues = [];
        let skipCount = 0;

        const funcStr = state.currentFunction;

        for (let i = 0; i <= resolution; i++) {
            const x = xMin + i * step;

            try {
                const y = hybridEvaluate(funcStr, { x: x });

                if (isFinite(y) && Math.abs(y) < 1e10) {
                    xValues.push(x);
                    yValues.push(y);
                } else {
                    skipCount++;
                }
            } catch (e) {
                skipCount++;
            }
        }

        if (xValues.length < 10) {
            throw new Error('Function has too many discontinuities to plot');
        }

        const trace = {
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines',
            line: {
                color: '#667eea',
                width: 3
            },
            name: 'f(x)'
        };

        const isDark = document.body.classList.contains('dark');
        const textColor = isDark ? '#f5f5f7' : '#1d1d1f';
        const borderColor = isDark ? '#38383a' : '#d2d2d7';

        const layout = {
            title: {
                text: `f(x) = ${state.currentFunction}`,
                font: {
                    family: '-apple-system, BlinkMacSystemFont',
                    size: 18,
                    color: textColor
                }
            },
            xaxis: {
                title: 'x',
                gridcolor: borderColor,
                zerolinecolor: borderColor,
                color: textColor
            },
            yaxis: {
                title: 'f(x)',
                gridcolor: borderColor,
                zerolinecolor: borderColor,
                color: textColor
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                color: textColor
            },
            margin: { t: 60, r: 40, b: 60, l: 60 }
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
        };

        Plotly.newPlot(plotDiv, [trace], layout, config);

        if (skipCount > 0) {
            plotDiv.insertAdjacentHTML('afterend', 
                `<div style="padding:10px;text-align:center;color:var(--text-secondary);font-size:12px;">
                    ℹ️ ${skipCount} points skipped due to discontinuities
                </div>`
            );
        }

    } catch (error) {
        console.error('Plot error:', error);
        plotDiv.innerHTML = `
            <div class="alert alert-error">
                <span class="alert-icon">⚠</span>
                <div>
                    <strong>Unable to plot</strong><br>
                    ${escapeHtml(error.message)}
                    ${error.message.includes('Plotly') ? '<br><small>Try refreshing the page to reload plotting library</small>' : ''}
                </div>
            </div>
        `;
    }
}

function plot3D() {
    const func = state.currentFunction;
    const plotDiv = document.getElementById('plot3dDiv');

    if (!func.includes('y')) {
        plotDiv.innerHTML = `
            <div class="alert alert-warning">
                <span class="alert-icon">ℹ️</span>
                <span>Function must contain variables x and y for 3D plotting (e.g., sin(x)*cos(y))</span>
            </div>
        `;
        return;
    }

    try {
        checkPlotlyAvailable();

        const gridSize = 40;
        const range = 5;
        const step = (2 * range) / gridSize;

        const xValues = [];
        const yValues = [];
        const zValues = [];
        let skipCount = 0;

        for (let i = 0; i <= gridSize; i++) {
            const row = [];
            const x = -range + i * step;
            xValues.push(x);

            for (let j = 0; j <= gridSize; j++) {
                const y = -range + j * step;

                if (i === 0) {
                    yValues.push(y);
                }

                try {
                    const z = hybridEvaluate(func, { x: x, y: y });
                    if (isFinite(z) && Math.abs(z) < 1e6) {
                        row.push(z);
                    } else {
                        row.push(null);
                        skipCount++;
                    }
                } catch (e) {
                    row.push(null);
                    skipCount++;
                }
            }
            zValues.push(row);
        }

        const validValues = [];
        zValues.forEach(row => row.forEach(value => {
            if (typeof value === 'number' && isFinite(value)) {
                validValues.push(value);
            }
        }));

        if (validValues.length < 25) {
            throw new Error('3D surface needs more valid sample points. Adjust the function or domain.');
        }

        let zMin = Math.min(...validValues);
        let zMax = Math.max(...validValues);

        if (!isFinite(zMin) || !isFinite(zMax)) {
            zMin = -1;
            zMax = 1;
        }

        if (zMin === zMax) {
            const padding = Math.max(1, Math.abs(zMin) * 0.1 || 1);
            zMin -= padding;
            zMax += padding;
        }

        const isDark = document.body.classList.contains('dark');
        const textColor = isDark ? '#f5f5f7' : '#0f172a';
        const gridColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.12)';
        const axisLineColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.4)';
        const sceneBackground = isDark ? 'rgba(5,8,15,0.95)' : 'rgba(255,255,255,0.92)';
        const surfaceColorscale = isDark
            ? [
                [0, '#1d4ed8'],
                [0.5, '#a855f7'],
                [1, '#f472b6']
            ]
            : [
                [0, '#0f172a'],
                [0.5, '#2563eb'],
                [1, '#60a5fa']
            ];

        const trace = {
            x: xValues,
            y: yValues,
            z: zValues,
            type: 'surface',
            colorscale: surfaceColorscale,
            showscale: true,
            opacity: 0.98,
            lighting: {
                ambient: 0.5,
                diffuse: 0.8,
                specular: 0.3,
                roughness: 0.6
            },
            contours: {
                z: {
                    show: true,
                    usecolormap: true,
                    highlightcolor: isDark ? '#22d3ee' : '#0ea5e9',
                    project: { z: true }
                }
            }
        };

        const layout = {
            title: {
                text: `f(x,y) = ${func}`,
                font: {
                    family: '-apple-system, BlinkMacSystemFont',
                    size: 18,
                    color: textColor
                }
            },
            scene: {
                xaxis: { 
                    title: 'x',
                    color: textColor,
                    gridcolor: gridColor,
                    zerolinecolor: axisLineColor,
                    linecolor: axisLineColor,
                    range: [-range, range],
                    tickfont: { color: textColor }
                },
                yaxis: { 
                    title: 'y',
                    color: textColor,
                    gridcolor: gridColor,
                    zerolinecolor: axisLineColor,
                    linecolor: axisLineColor,
                    range: [-range, range],
                    tickfont: { color: textColor }
                },
                zaxis: { 
                    title: 'f(x,y)',
                    color: textColor,
                    gridcolor: gridColor,
                    zerolinecolor: axisLineColor,
                    linecolor: axisLineColor,
                    range: [zMin, zMax],
                    tickfont: { color: textColor }
                },
                bgcolor: sceneBackground,
                aspectmode: 'cube'
            },
            paper_bgcolor: sceneBackground,
            font: {
                color: textColor
            },
            margin: { t: 60, r: 20, b: 20, l: 20 }
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
        };

        Plotly.newPlot(plotDiv, [trace], layout, config);

    } catch (error) {
        console.error('3D Plot error:', error);
        plotDiv.innerHTML = `
            <div class="alert alert-error">
                <span class="alert-icon">⚠</span>
                <div>
                    <strong>Unable to create 3D plot</strong><br>
                    ${escapeHtml(error.message)}
                    ${error.message.includes('Plotly') ? '<br><small>Try refreshing the page to reload plotting library</small>' : ''}
                </div>
            </div>
        `;
    }
}

// ==================== ALERTS ====================
function showAlert(message, type = 'error') {
    const container = document.getElementById('results');
    const icons = {
        error: '⚠',
        success: '✓',
        warning: 'ℹ️'
    };

    container.innerHTML = `
        <div class="alert alert-${type}">
            <span class="alert-icon">${icons[type]}</span>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
}

// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function clearAll() {
    document.getElementById('functionInput').value = '';
    document.getElementById('preview').textContent = 'Enter a function to begin...';
    document.getElementById('preview').className = 'preview-box';

    state.currentFunction = '';
    state.compiledFunction = null;
    state.lastResult = null;

    document.getElementById('results').innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">🧮</div>
            <h3>Ready to Compute</h3>
            <p>Enter a function and select an operation to begin</p>
        </div>
    `;

    const stepsElement = document.getElementById('steps');
    stepsElement.classList.remove('show-timeline');
    stepsElement.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">📖</div>
            <h3>Step-by-Step Solutions</h3>
            <p>Computation steps will appear here</p>
        </div>
    `;

    document.getElementById('plot2d').innerHTML = '';
    document.getElementById('plot3dDiv').innerHTML = '';
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter to compute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compute();
    }

    // Ctrl/Cmd + K to clear
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        clearAll();
    }
});

// ==================== AUTO-SAVE ====================
let autoSaveTimeout;
document.getElementById('functionInput').addEventListener('input', function() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        localStorage.setItem('lastFunction', this.value);
    }, 1000);
});

// Load last function on startup
window.addEventListener('load', function() {
    const lastFunction = localStorage.getItem('lastFunction');
    if (lastFunction) {
        document.getElementById('functionInput').value = lastFunction;
        validateFunction();
    }
});

