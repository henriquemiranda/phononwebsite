from setuptools import setup

scripts_phononwebsite = ['scripts/read_qe_phonon.py',
                         'scripts/read_anaddb_phonon.py',
                         'scripts/read_vasp_phonon.py',
                         'scripts/phononwebsite.py']
packages_phononwebsite = ['phononweb']

if __name__ == '__main__':
    setup(name='phononwebsite',
          version='0.1',
          description='Read abinit and quantum espresso phonon dispersions to visualize on the phonon website.',
          author='Henrique Miranda',
          author_email='miranda.henrique@gmail.com',
          scripts=scripts_phononwebsite,
          packages=packages_phononwebsite
          )


