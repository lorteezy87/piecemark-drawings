#!/usr/bin/env python3
"""Apply IDS-required attributes/psets/materials to pmc-steel.ifc."""
from __future__ import annotations

import ifcopenshell
import ifcopenshell.guid
import ifcopenshell.util.element as eu

PATH = "/workspace/public/models/pmc-steel.ifc"

PSET_MAP = {
    "IfcColumn": ("Pset_ColumnCommon", {"LoadBearing": True}),
    "IfcBeam": ("Pset_BeamCommon", {"LoadBearing": True}),
    "IfcMember": ("Pset_MemberCommon", {"LoadBearing": True}),
    "IfcFooting": ("Pset_FootingCommon", {"LoadBearing": True}),
}


def object_type_for(ent) -> str:
    tag = ent.Tag or ""
    t = ent.is_a()
    if t == "IfcColumn":
        return "W14X90"
    if t == "IfcBeam":
        if tag.startswith("BY"):
            return "W16X26"
        return "W21X44"
    if t == "IfcMember":
        return "HSS6X6X3/8"
    if t == "IfcFooting":
        return "FOOTING_PAD_5X5"
    return "STEEL_MEMBER"


def set_attr(ent, name: str, value) -> bool:
    i = 0
    while i <= 20:
        try:
            n = ent.attribute_name(i)
        except Exception:
            break
        if n == name:
            ent[i] = value
            return True
        i += 1
    return False


def ensure_material(ifc, ent, steel, owner) -> bool:
    if eu.get_material(ent) is not None:
        return False
    ifc.create_entity(
        "IfcRelAssociatesMaterial",
        ifcopenshell.guid.new(),
        owner,
        None,
        None,
        [ent],
        steel,
    )
    return True


def ensure_pset(ifc, ent, pset_name: str, props: dict, owner) -> bool:
    psets = eu.get_psets(ent)
    if pset_name in psets and all(k in psets[pset_name] for k in props):
        return False

    if pset_name in psets:
        for rel in getattr(ent, "IsDefinedBy", []) or []:
            if not rel.is_a("IfcRelDefinesByProperties"):
                continue
            pd = rel.RelatingPropertyDefinition
            if pd.is_a("IfcPropertySet") and pd.Name == pset_name:
                existing = psets[pset_name]
                for k, v in props.items():
                    if k in existing:
                        continue
                    val = (
                        ifc.create_entity("IfcBoolean", v)
                        if isinstance(v, bool)
                        else ifc.create_entity("IfcLabel", str(v))
                    )
                    p = ifc.create_entity(
                        "IfcPropertySingleValue", k, None, val, None
                    )
                    props_list = list(pd.HasProperties or [])
                    props_list.append(p)
                    pd.HasProperties = props_list
                return True
        return False

    prop_ents = []
    for k, v in props.items():
        val = (
            ifc.create_entity("IfcBoolean", v)
            if isinstance(v, bool)
            else ifc.create_entity("IfcLabel", str(v))
        )
        prop_ents.append(
            ifc.create_entity("IfcPropertySingleValue", k, None, val, None)
        )
    pset = ifc.create_entity(
        "IfcPropertySet",
        ifcopenshell.guid.new(),
        owner,
        pset_name,
        None,
        prop_ents,
    )
    ifc.create_entity(
        "IfcRelDefinesByProperties",
        ifcopenshell.guid.new(),
        owner,
        None,
        None,
        [ent],
        pset,
    )
    return True


def main() -> None:
    ifc = ifcopenshell.open(PATH)
    steel = next(
        m
        for m in ifc.by_type("IfcMaterial")
        if m.Name and "A992" in (m.Name or "")
    )
    owner = ifc.by_type("IfcOwnerHistory")[0]
    counts = {"objectType": 0, "pset": 0, "material": 0}

    for t, (pset_name, props) in PSET_MAP.items():
        for ent in ifc.by_type(t):
            if ent[4] in (None, ""):
                set_attr(ent, "ObjectType", object_type_for(ent))
                counts["objectType"] += 1
            if ensure_material(ifc, ent, steel, owner):
                counts["material"] += 1
            if ensure_pset(ifc, ent, pset_name, props, owner):
                counts["pset"] += 1

    ifc.write(PATH)
    print("updated", PATH, counts)


if __name__ == "__main__":
    main()
