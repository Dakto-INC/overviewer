import os
import yaml
import json

YAML_PATH = "/minecraft/servers/server6/plugins/WorldGuard/worlds/world/regions.yml"
JSON_OUTPUT = "/srv/overviewer/regions.json"

def parse_worldguard_pois():
    if not os.path.exists(YAML_PATH):
        print(f"Error: Could not find WorldGuard file at {YAML_PATH}")
        return

    with open(YAML_PATH, "r") as f:
        try:
            data = yaml.safe_load(f)
        except Exception as e:
            print(f"Error parsing YAML: {e}")
            return

    regions_list = []
    regions = data.get("regions", {})

    for name, r_data in regions.items():
        reg_type = r_data.get("type")
        if reg_type not in ["cuboid", "poly"]:
            continue

        if reg_type == "cuboid":
            min_pt = r_data.get("min", {})
            max_pt = r_data.get("max", {})
            if not min_pt or not max_pt:
                continue
            x = (min_pt["x"] + max_pt["x"]) // 2
            z = (min_pt["z"] + max_pt["z"]) // 2
            y = max_pt.get("y", 64)
        
        elif reg_type == "poly":
            raw_pts = r_data.get("points", [])
            if not raw_pts:
                continue
            x = sum(pt["x"] for pt in raw_pts) // len(raw_pts)
            z = sum(pt["z"] for pt in raw_pts) // len(raw_pts)
            y = r_data.get("max-y", 64)

        owners = r_data.get("owners", {}).get("players", [])
        members = r_data.get("members", {}).get("players", [])
        flags = r_data.get("flags", {})

        # Format matches standard Overviewer POI dictionary templates
        regions_list.append({
            "id": "WorldGuard POI",
            "x": int(x),
            "y": int(y),
            "z": int(z),
            "name": name,
            "owners": list(owners),
            "members": list(members),
            "flags": flags
        })

    with open(JSON_OUTPUT, "w") as f:
        json.dump(regions_list, f, indent=2)
    print(f"Compiled {len(regions_list)} native POI entities to {JSON_OUTPUT}")

if __name__ == "__main__":
    parse_worldguard_pois()
