# Local media

`media/music/` contains the private local soundtrack used by the AFK player. The
audio is intentionally excluded from Git and from the public source bundle:
publishing it requires distribution rights from the copyright owner.

The portable private bundle may include this directory when it is created for a
machine controlled by the project owner. The web server exposes these tracks
only when `SOVET_PUBLIC_MUSIC=1`; keep that flag disabled until the rights are
cleared.
