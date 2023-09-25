export default {
    input: 'src/phononwebsite.js',
    // sourceMap: true,
    output: [
        {
            format: 'umd',
            name: 'phononwebsite',
            file: 'build/phononwebsite.js',
        },
        {
            format: 'es',
            file: 'build/phononwebsite.module.js',
        }
    ]
};
