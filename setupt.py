from distutils.core import setup


if __name__ == '__main__':
    setup(name='phononwebsite',
          version='0.1',
          description='Read abinit and quantum espresso phonon dispersions to visualize on the phonon website.',
          author='Henrique Miranda',
          author_email='miranda.henrique@gmail.com',
          scripts=scripts_phononwebsite,
          )

scripts_phonopy = ['scripts/phonopy',
                   'scripts/pdosplot']
