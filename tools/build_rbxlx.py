"""Build AllStar.rbxlx (Roblox XML place) from src/ without Rojo."""
import os, sys
from xml.sax.saxutils import escape
root = sys.argv[1]; out = sys.argv[2]
ref = [0]
def nref():
    ref[0] += 1; return f"RBX{ref[0]:08d}"

def item(cls, name, props="", children=""):
    return (f'<Item class="{cls}" referent="{nref()}"><Properties>'
            f'<string name="Name">{escape(name)}</string>{props}</Properties>{children}</Item>\n')

def source(path):
    s = open(path, encoding="utf-8").read()
    assert "]]>" not in s, path
    return f'<ProtectedString name="Source"><![CDATA[{s}]]></ProtectedString>'

def classify(fname):
    if fname.endswith(".server.luau"): return "Script", fname[:-len(".server.luau")]
    if fname.endswith(".client.luau"): return "LocalScript", fname[:-len(".client.luau")]
    return "ModuleScript", fname[:-len(".luau")]

def dir_item(path, name):
    files = sorted(os.listdir(path))
    init = [f for f in files if f.startswith("init.")]
    children = ""
    for f in files:
        if f.startswith("init."): continue
        p = os.path.join(path, f)
        if os.path.isdir(p): children += dir_item(p, f)
        elif f.endswith(".luau"):
            cls, n = classify(f); children += item(cls, n, source(p))
    if init:
        cls, _ = classify(init[0])
        return item(cls, name, source(os.path.join(path, init[0])), children)
    return item("Folder", name, "", children)

def part(cls, name, size, pos, rgb, material, extra=""):
    x,y,z = pos; sx,sy,sz = size
    color = (0xFF << 24) | (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
    props = (f'<bool name="Anchored">true</bool><bool name="Locked">true</bool>'
             f'<CoordinateFrame name="CFrame"><X>{x}</X><Y>{y}</Y><Z>{z}</Z>'
             '<R00>1</R00><R01>0</R01><R02>0</R02><R10>0</R10><R11>1</R11><R12>0</R12>'
             '<R20>0</R20><R21>0</R21><R22>1</R22></CoordinateFrame>'
             f'<Vector3 name="size"><X>{sx}</X><Y>{sy}</Y><Z>{sz}</Z></Vector3>'
             f'<Color3uint8 name="Color3uint8">{color}</Color3uint8>'
             f'<token name="Material">{material}</token>' + extra)
    return item(cls, name, props)

src = os.path.join(root, "src")
body = ""
body += item("Workspace", "Workspace", "",
    part("Part", "Baseplate", (512,16,512), (0,-8,0), (31,31,38), 800) +   # Slate
    part("SpawnLocation", "SpawnLocation", (12,1,12), (0,0.5,0), (70,225,255), 288))  # Neon
body += item("Lighting", "Lighting", '<float name="ClockTime">20.5</float><float name="Brightness">1.5</float>')
body += item("ReplicatedStorage", "ReplicatedStorage", "", dir_item(os.path.join(src,"ReplicatedStorage","AllStar"), "AllStar"))
body += item("ServerScriptService", "ServerScriptService", "", dir_item(os.path.join(src,"ServerScriptService","AllStarServer"), "AllStarServer"))
body += item("StarterPlayer", "StarterPlayer", "",
    item("StarterPlayerScripts", "StarterPlayerScripts", "",
        dir_item(os.path.join(src,"StarterPlayer","StarterPlayerScripts","AllStarClient"), "AllStarClient")))
doc = ('<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" '
       'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
       'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">\n'
       '<External>null</External><External>nil</External>\n' + body + '</roblox>\n')
open(out, "w", encoding="utf-8").write(doc)
