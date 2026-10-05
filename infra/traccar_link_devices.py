"""
Make the auto-registered demo trackers visible in Traccar's web UI.

Traccar registers unknown trackers automatically but links them to no user, so the
admin's device list stays empty. This script (run once, after the demo has started):
  1. creates a "FleetFusion demo fleet" group and links it to your account,
  2. moves every existing tracker into that group,
  3. writes the group as `database.registerUnknown.defaultGroupId` in infra/traccar/traccar.xml,
     so trackers registered later appear automatically (after one Traccar restart).

Usage (stdlib only; your password is prompted, sent only to your local Traccar, never stored):
    python3 infra/traccar_link_devices.py [--url http://localhost:8082]
"""

import argparse
import getpass
import http.cookiejar
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

GROUP_NAME = "FleetFusion demo fleet"
CONFIG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "traccar", "traccar.xml")


class Traccar:
    """Logs in like Traccar's web app (form POST /api/session -> session cookie) and reuses the session."""

    def __init__(self, url: str):
        self.url = url.rstrip("/")
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def login(self, email: str, password: str):
        data = urllib.parse.urlencode({"email": email, "password": password}).encode()
        req = urllib.request.Request(f"{self.url}/api/session", data=data, method="POST",
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
        with self.opener.open(req, timeout=10) as resp:
            return json.loads(resp.read())

    def call(self, method: str, path: str, body=None):
        req = urllib.request.Request(f"{self.url}/api{path}", method=method,
                                     headers={"Content-Type": "application/json", "Accept": "application/json"},
                                     data=json.dumps(body).encode() if body is not None else None)
        with self.opener.open(req, timeout=10) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8082")
    args = ap.parse_args()

    email = input("Traccar admin email: ").strip()
    api = Traccar(args.url)

    try:
        user = api.login(email, getpass.getpass("Traccar admin password: "))
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Login failed ({e.code}). Check the email/password you created at {args.url}.")
    if not user.get("administrator"):
        raise SystemExit("This account is not an administrator; use the first account created in Traccar.")

    groups = api.call("GET", "/groups?all=true") or []
    group = next((g for g in groups if g.get("name") == GROUP_NAME), None)
    if group is None:
        group = api.call("POST", "/groups", {"name": GROUP_NAME})
        print(f"Created group '{GROUP_NAME}' (id {group['id']})")
    try:
        api.call("POST", "/permissions", {"userId": user["id"], "groupId": group["id"]})
        print("Linked the group to your account")
    except urllib.error.HTTPError:
        print("Group already linked to your account")

    devices = api.call("GET", "/devices?all=true") or []
    moved = 0
    for d in devices:
        if d.get("groupId") != group["id"]:
            d["groupId"] = group["id"]
            api.call("PUT", f"/devices/{d['id']}", d)
            moved += 1
    print(f"{len(devices)} trackers found, {moved} moved into the group")

    xml = open(CONFIG).read()
    entry = f"<entry key='database.registerUnknown.defaultGroupId'>{group['id']}</entry>"
    if "registerUnknown.defaultGroupId" in xml:
        xml = re.sub(r"<entry key='database\.registerUnknown\.defaultGroupId'>\d+</entry>", entry, xml)
    else:
        xml = xml.replace("    <entry key='database.registerUnknown'>true</entry>\n",
                          "    <entry key='database.registerUnknown'>true</entry>\n"
                          "    <!-- New trackers join the demo group so they show up in the admin's list -->\n"
                          f"    {entry}\n")
    open(CONFIG, "w").write(xml)
    print("Saved the group as the default for new trackers. Apply it with: docker restart fleetfusion-traccar")
    print(f"Done. Refresh {args.url}: the trucks are listed on the left of the map.")


if __name__ == "__main__":
    main()
