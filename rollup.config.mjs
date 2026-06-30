import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const plugins = [
    resolve(),
    commonjs()
];

export default [
    {
        input: 'src/main.js',
        output: [
            {
                format: 'es',
                file: 'build/main.js',
                sourcemap: true,
            }
        ],
        plugins,
    },
    {
        input: 'src/excitonmain.js',
        output: [
            {
                format: 'es',
                file: 'build/exciton.js',
                sourcemap: true,
            }
        ],
        plugins,
    },
    {
        input: 'src/structuremain.js',
        output: [
            {
                format: 'es',
                file: 'build/structure.js',
                sourcemap: true,
            }
        ],
        plugins,
    },
    {
        input: 'src/marchingcubesworker.js',
        output: [
            {
                format: 'es',
                file: 'build/marchingcubesworker.js',
                sourcemap: true,
            }
        ],
        plugins,
    },
    {
        input: 'src/alloymain.js',
        output: [
            {
                format: 'es',
                file: 'build/alloy.js',
                sourcemap: true,
            }
        ],
        plugins,
    },
    {
        input: 'src/zumbamain.js',
        output: [
            {
                format: 'es',
                file: 'build/zumba.js',
                sourcemap: true,
            }
        ],
        plugins,
    },
];