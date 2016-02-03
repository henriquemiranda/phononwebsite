import os

os.system('pandoc README.md -f markdown -t html -o readme.html')

print("Reading readme.html")
f = open('readme.html')
pandoc = f.read()
f.close()

print("Reading reference index.html from ref_index.html")
f = open('ref_index.html')
ref = f.read()
f.close()

print("replacing PANDOC")
ref = ref.replace("PANDOC",pandoc)

print("Writing index.html")
f = open('index.html','w')
f.write(ref)
f.close()
