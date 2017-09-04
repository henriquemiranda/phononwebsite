PhononWebsite
===================================

In this new version all the different components of the website are modular.
There is a general class PhononWebsite class that handles the interface between the
webpage and the different components.

There are three generic components:

    1. PhononWebsite
    2. Visualizer
    3. Dispersion
    4. Input

The components that the website uses depends on the initialization of the PhononWebsite class.

Example:
visualizer = new VibCrystal();
dispersion = new DispersionHighcharts();
phonon  = new PhononWebsite(visualizer,dispersion);

The comunication between the PhononWebsite class and the other classes depends
on a well defined set of rules.


PhononnWeb
===================================

This class provides the interface between the webpage and all the other components.

Contains:
    - phonon structure provided by Input (see bellow)



Visualizer
===================================

class VibCrystal
-------------------------
This is the implementation of the visualizer class made using Three.js








Dispersion
===================================

class PhononHighcharts
-------------------------
This is the implementation of the phonon dispersion
visualization using the Highcharts class
All the actions from this class should call a function from the PhononWebsite class









Input
===================================

class PhononYaml
-----------------
Read Yaml file from phonopy to the internal json format

class PhononJSON
-----------------
Read internal json format from a local or online file

