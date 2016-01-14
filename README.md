Phonon website
==============

Visualize phonon vibrational modes.

This project aims to provide a simple way to visualize the lattice vibrations of different materials. The temperature of a material is related to the agitation of its atoms. The atoms can move in any of the three cartesian directions. Combining the different possible ways the atoms can vibrate we obtain the eigenmodes. Each mode has associated a frequency of vibration that is related with the forces between the atoms.

How to use?
===========

In the phonon section you can click on any point in the dispersion relation and see an animation of how the atoms vibrate in that particular mode.

Currently the included python script reads a NetCDF output file from ``anaddb`` that is provided with the ``abinit`` package.  
I also have a script to read the matdyn.x output from Quantum Espresso ``ph.x`` and write it in the ``anaddb`` NetCDF format.   

The user can visualize his own phonopy files by clicking on the ``Choose files`` button and selecting a ``band.yaml`` and a ``disp.yaml`` file obtained from phonopy. The following options should be present in the ``band.conf`` file:


    EIGENVECTORS = .TRUE.
    BAND = (x1,y1,z1) (x2,y2,z2) (x3,y3,z3)

Authors
=======

This project is the continuation of the work of Raul Weber during and internship in the University of Luxembourg for 2 months in the Teoretical Solid State Physics group under the supervision of Ludger Wirtz and technical help from me.

I decided to continue the project by optimizing the implementation, cleaning up the design and replacing JSmol by a self made applet using Three.js and WebGL called VibCrystal.
Currently the website works also as a web application which means the user can visualize his own calculations made with ``phonopy``.

For more information about us and our work visit:  
<http://wwwen.uni.lu/>

The original implementation by Raoul Weber:  
<http://tssphysics.jpsfs.com>

My personal webpage:  
<http://henriquemiranda.github.io>

Contact me:  
miranda.henrique at gmail.com

Contribute
==========

The project is still under development!  

You can leave your suggestions and feature requests here:  
<https://github.com/henriquemiranda/phononwebsite/issues>

If you would like to see some of your calculations published on this website please contact me.

Software used for this project
========

- The WebGL visualization is made using Three.js: <http://threejs.org/>
- The phonon dispersion is plotted using highcharts: <http://www.highcharts.com/>  

- Abinit: <http://www.abinit.org/>
- Quantum Espresso: <http://www.quantum-espresso.org/>
- Phonopy: <http://atztogo.github.io/phonopy/>
