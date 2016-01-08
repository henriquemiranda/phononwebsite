phonon website
==============

Visualize phonon vibrational modes.

This project is the continuation of the work of Raul Weber during and internship in the University of Luxembourg during 2 months under the supervisions of Ludger Wirtz and technical help from me.
I decided to continue the project by optimizing the implementation, cleaning up the design and replacing JSmol by a self made applet using Three.js and WebGL called VibCrystal.

contribute
==========

The project is still under development, suggestions and bugfixes are welcome!

If you would like to see some data added here please contact me:  
miranda.henrique at gmail.com

Currently the python script reads a NetCDF output file from anaddb that is provided with the abinit package.
I also have a script to read the matdyn.x output from Quantum Espresso and write it in the anaddb NetCDF format.

In the future interfaces with other codes should be added

author
======
Henrique Miranda
Based on the implementation done by Raoul Weber: http://tssphysics.jpsfs.com/

- The WebGL visualization is made using Three.js: http://threejs.org/
- The phonon dispersion is plotted using highcharts.js: http://www.highcharts.com/

- Abinit website: http://www.abinit.org/
- Quantum Espresso website: http://www.quantum-espresso.org/
