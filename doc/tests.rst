Development and Test suite notes
=========================================

These notes describe some of the development process of this package.

I will describe here the process used to create the test suite.
I need the test suite to run on the browser and test a minimum of 50% of the code.
The code is using Requirejs to load the different modules.
This was a requirement for the integration with the materials project website.
Requirejs can be used to minify the code (TODO).
All the tests should be able to run on Chrome, Firefox and Safari.
The code provided in this package should be usable as a library.
Create official releases of the code (TODO) and distribute it with nodejs

References:
https://gist.github.com/nackjicholson/7ccdbb8030844b4e404a
https://stackoverflow.com/questions/42857778/how-do-you-run-mocha-tests-in-the-browser

