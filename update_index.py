import os

os.system('pandoc README.md -f markdown -t html -o readme.html')

print("Reading readme.html")
with open('readme.html') as f:
    pandoc = f.read()
os.remove("readme.html")

print("Reading reference index.html from ref_index.html")
with open('ref_index.html') as f:
    ref = f.read()

print("replacing PANDOC")
ref = ref.replace("PANDOC",pandoc)

print("Writing index.html")
with open('index.html','w') as f:
    f.write(ref)
