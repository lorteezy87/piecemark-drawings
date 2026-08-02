#!/usr/bin/env python3
"""Validate an IFC model against a buildingSMART IDS file (ifctester)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import ifcopenshell
import ifcopenshell.util.element as eu
from ifctester.ids import open as ids_open


def diagnose_missing(ent, spec_name: str) -> list[str]:
    missing: list[str] = []
    for attr in ("Tag", "Name", "Description", "ObjectType"):
        val = getattr(ent, attr, None)
        if val is None or (isinstance(val, str) and not str(val).strip()):
            missing.append(attr)

    mat = eu.get_material(ent)
    if mat is None:
        missing.append("Material (IfcRelAssociatesMaterial)")
    else:
        mat_name = getattr(mat, "Name", None) or ""
        if "ASTM A992" in spec_name and "A992" not in str(mat_name):
            missing.append(f"Material grade (found '{mat_name}')")

    psets = eu.get_psets(ent)
    sn = spec_name
    if "Pset_ColumnCommon" in sn and "Pset_ColumnCommon" not in psets:
        missing.append("Pset_ColumnCommon.LoadBearing")
    if "Pset_BeamCommon" in sn and "Pset_BeamCommon" not in psets:
        missing.append("Pset_BeamCommon.LoadBearing")
    if "Pset_MemberCommon" in sn and "Pset_MemberCommon" not in psets:
        missing.append("Pset_MemberCommon.LoadBearing")
    if "Pset_FootingCommon" in sn and "Pset_FootingCommon" not in psets:
        missing.append("Pset_FootingCommon.LoadBearing")

    if not missing:
        if "ObjectType" in sn:
            missing.append("ObjectType")
        elif "Pset_" in sn or "LoadBearing" in sn:
            missing.append("required property set / property")
        elif "Material" in sn:
            missing.append("Material")
        else:
            missing.append("requirement not met")
    return missing


def validate(ids_path: Path, ifc_path: Path) -> dict:
    specs = ids_open(str(ids_path))
    ifc = ifcopenshell.open(str(ifc_path))
    specs.validate(ifc)

    failures: list[dict] = []
    summary_specs: list[dict] = []

    for spec in specs.specifications:
        failed = list(spec.failed_entities)
        passed = list(spec.passed_entities)
        if spec.status is True:
            status = "pass"
        elif spec.status is False:
            status = "fail"
        else:
            status = "pass" if len(failed) == 0 else "fail"

        summary_specs.append(
            {
                "name": spec.name,
                "description": spec.description or "",
                "status": status,
                "applicable": len(spec.applicable_entities),
                "passed": len(passed),
                "failed": len(failed),
            }
        )

        req_labels = []
        for r in spec.requirements:
            try:
                req_labels.append(r.to_string("requirement"))
            except Exception:
                req_labels.append(type(r).__name__)

        for ent in failed:
            missing = diagnose_missing(ent, spec.name or "")
            failures.append(
                {
                    "expressId": ent.id(),
                    "globalId": getattr(ent, "GlobalId", "") or "",
                    "ifcType": ent.is_a(),
                    "name": ent.Name or "",
                    "tag": ent.Tag or "",
                    "description": ent.Description or "",
                    "objectType": ent.ObjectType or "",
                    "specification": spec.name,
                    "requirement": "; ".join(req_labels) if req_labels else spec.name,
                    "missingProperties": missing,
                    "status": "fail",
                }
            )

    by_element: dict[int, dict] = {}
    for f in failures:
        key = f["expressId"]
        if key not in by_element:
            by_element[key] = {
                "expressId": f["expressId"],
                "globalId": f["globalId"],
                "ifcType": f["ifcType"],
                "name": f["name"],
                "tag": f["tag"],
                "failedSpecifications": [],
                "missingProperties": set(),
            }
        by_element[key]["failedSpecifications"].append(f["specification"])
        for m in f["missingProperties"]:
            by_element[key]["missingProperties"].add(m)

    element_rows = []
    for e in by_element.values():
        element_rows.append(
            {
                "expressId": e["expressId"],
                "globalId": e["globalId"],
                "ifcType": e["ifcType"],
                "name": e["name"],
                "tag": e["tag"],
                "failedSpecifications": e["failedSpecifications"],
                "missingProperties": sorted(e["missingProperties"]),
                "failCount": len(e["failedSpecifications"]),
            }
        )
    element_rows.sort(
        key=lambda r: (-r["failCount"], r["ifcType"], r["tag"] or r["name"])
    )

    return {
        "ids": {
            "title": specs.info.get("title"),
            "version": specs.info.get("version"),
            "path": f"/ids/{ids_path.name}",
            "filename": ids_path.name,
        },
        "ifc": {
            "path": f"/models/{ifc_path.name}",
            "filename": ifc_path.name,
            "schema": ifc.schema,
            "project": next((p.Name for p in ifc.by_type("IfcProject")), None),
        },
        "summary": {
            "totalSpecifications": len(summary_specs),
            "specificationsPassed": sum(
                1 for s in summary_specs if s["status"] == "pass"
            ),
            "specificationsFailed": sum(
                1 for s in summary_specs if s["status"] == "fail"
            ),
            "totalFailureRows": len(failures),
            "uniqueElementsFailing": len(element_rows),
            "overallPass": all(s["status"] == "pass" for s in summary_specs),
        },
        "specifications": summary_specs,
        "failures": failures,
        "elements": element_rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ids",
        default="/workspace/public/ids/steel-fab-erection.ids",
        help="Path to IDS file",
    )
    parser.add_argument(
        "--ifc",
        default="/workspace/public/models/pmc-steel.ifc",
        help="Path to IFC file",
    )
    parser.add_argument(
        "--out",
        default="/workspace/public/ids/validation-results.json",
        help="Output JSON report path",
    )
    args = parser.parse_args()

    report = validate(Path(args.ids), Path(args.ifc))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    print(json.dumps(report["summary"], indent=2))
    print(f"Wrote {out}")
    return 0 if report["summary"]["overallPass"] else 1


if __name__ == "__main__":
    sys.exit(main())
