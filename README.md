Phonon website
==============

Visualize phonon vibrational modes.

This project aims to provide a simple way to visualize the lattice vibrations of different materials. The temperature of a material is related to the agitation of its atoms. The atoms can move in any of the three cartesian directions. Combining the different possible ways the atoms can vibrate we obtain the eigenvectors. Each mode has associated a frequency of vibration that is related with the forces between the atoms.

How to use?
===========

In the phonon section you can click on any point in the dispersion relation and see an animation of how the atoms vibrate in that particular mode.
By default you can visualize the phonon dispersion of some materials we calculated.
If you want to see your own calculations, we currently support phonon calculations form `Abinit`, `Quantum Espresso` and `phononpy`.

phonopy
-------
You can visualize your own `phonopy` files by clicking on the `Choose files` button and selecting a `band.yaml` and a `disp.yaml` files. The following options should be present in the `band.conf` file:

    EIGENVECTORS = .TRUE.
    BAND_CONNECTION = .TRUE.
    BAND_LABELS = Gamma M K
    BAND = (x1,y1,z1) (x2,y2,z2) (x3,y3,z3)

Abinit
------
To read a phonon dispersion form `Abinit` we provide some python scripts to convert the data to a `.json` format.
You can obtain these scripts form the Github page. To install them just do:

    python setup.py install --user

In the folder where you ran `anaddb` you will find a netCDF file (if your `Abinit` version has netCDF compiled) with the name `anaddb.out_PHBST.nc`. To convert it to `.json` format just run:

    read_anaddb_phonon.py anaddb.out_PHBST.nc <name_of_your_material>

You can then select the resulting `.json` file with the `Choose files` button.

Quantum Espresso
----------------
To read a Quantum Espresso calculation you need two files `<prefix>.scf` and `<prefix>.modes`. The first one is the input file for `pw.x` the second one can be generated with `dynmat.x`.
After installing the python scripts (as in the case of an `Abinit` calculation) you can obtain the `.json` files:

    read_qe_phonon.py prefix <name_of_your_material>

You can then select the resulting `.json` file with the `Choose files` button.

Features
========
You can export the lattice distorted according to the currently selected phonon mode to a `.xsf` or `POSCAR` file.
The `phase` and `amplitude` sliders define a complex number that is multiplied by the phonon eigenvectors to obtain the displacements.

You can export a animated `.gif` with a particular mode using the `gif` button in the Export movie section.

If you want to share your own data with someone else you can add to the url tags with the following format:

    http://henriquemiranda.github.io/phononwebsite/phonon.html?tag1=a&tag2=b

The available tags are:

    json, band.yaml, disp.yaml = link to a file
    name = name of the material
    url = path where to find `band.yaml` and `disp.yaml` files.

Here are some examples of what can be added to the website link:

  - [?url=http://henriquemiranda.github.io/phononwebsite/tests/phonopy](http://henriquemiranda.github.io/phononwebsite/phonon.html?url=http://henriquemiranda.github.io/phononwebsite/tests/phonopy&name=Graphene)
  - [?json=http://henriquemiranda.github.io/phononwebsite/graphene/data.json](http://henriquemiranda.github.io/phononwebsite/phonon.html?json=http://henriquemiranda.github.io/phononwebsite/graphene/data.json)

You are free to use all the images generated with this website in your publications and presentations as long as you cite this work (a link to the website is enough).

Authors
=======

This project is the continuation of the work of Raoul Weber during an internship in the University of Luxembourg for 2 months in the Theoretical Solid State Physics group under the supervision of Ludger Wirtz and technical help from me.

I decided to continue the project by optimizing the implementation, cleaning up the design and replacing JSmol by a self made applet using Three.js and WebGL called VibCrystal.
Currently the website works also as a web application which means the user can visualize his own calculations made with `phonopy`.

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
==============================

- The WebGL visualization is made using `Three.js`: <http://threejs.org/>
- The phonon dispersion is plotted using `highcharts`: <http://www.highcharts.com/>  
- The export animation is provided using `CCapture.js`: <https://github.com/spite/ccapture.js>
- The gif animation is uses `gif.js`: <http://jnordberg.github.io/gif.js/>

- `Abinit`: <http://www.abinit.org/>
- `Quantum Espresso`: <http://www.quantum-espresso.org/>
- `phonopy`: <http://atztogo.github.io/phonopy/>
