# Content domain

An eXeLearning package contains HTML and JavaScript written by its author. By
default the plugin serves it from the Moodle site, so that code runs in the Moodle
origin with the session of whoever opens the activity (see the security model in
[TRACKING.md](TRACKING.md), threats 8 and 10).

A **content domain** is an optional setup that removes that: each activity is served
from its own origin on a second domain, `https://<label>.<content domain>`. The
package cannot read the Moodle page, its cookies or its session key, and cannot make
authenticated requests to Moodle. Grades are still recorded.

If the setting is empty, nothing on this page applies and the plugin behaves as it
always has.

This is the same idea as the `EXE_CONTENT_DOMAIN` setting of eXeLearning itself. One
domain can serve both: eXeLearning labels start with `v` or `p`, the plugin's with `m`.

## What you need

| Requirement | Example |
|---|---|
| A second domain, on a **different site** from Moodle | `exelearningusercontent.com` for a Moodle at `moodle.example.org` |
| A wildcard DNS record for it | `*.exelearningusercontent.com` |
| A wildcard TLS certificate | `*.exelearningusercontent.com` |
| A web server rule that sends the wildcard host to the same Moodle, for the content endpoint only | see below |

Then set **Site administration > Plugins > Activity modules > eXeLearning > Content
domain** to the domain, or force it in `config.php`:

```php
$CFG->forced_plugin_settings['exelearning']['contentdomain'] = 'exelearningusercontent.com';
```

The value is `host[:port]`: no scheme, no path, no `*.`. Add the port only when the
content is served on a non-default port. The content is served with the scheme of
`$CFG->wwwroot`.

## Choose a domain on a different site

Use a separate registrable domain, not a subdomain of the Moodle site.
`content.moodle.example.org` is a different *origin* from `moodle.example.org` but
the same *site*, and three protections work per site:

- **Cookies.** A cookie set for the parent domain is sent to the subdomain, and the
  subdomain can set cookies for the parent domain.
- **SameSite.** Requests from the content to Moodle count as same-site, so the
  session cookie is sent with them.
- **Process isolation.** Browsers may run two origins of the same site in one process.

A subdomain of the Moodle host is accepted, and the settings page shows a warning.
The Moodle host itself, or a parent of it (`example.org` for `moodle.example.org`),
is refused.

## DNS and TLS

One wildcard record pointing at the web server, and a certificate for the same name.
Content hosts are one label deep, so a single wildcard covers them.

```text
*.exelearningusercontent.com.  300  IN  A  203.0.113.10
```

A wildcard certificate needs a DNS-01 challenge, for example:

```bash
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d '*.exelearningusercontent.com'
```

## Web server

The content hosts go to the **same** Moodle as the site, and must be able to reach
**only** the content endpoint, `/mod/exelearning/content.php/…`.

That restriction matters. Moodle redirects a request for any other host to
`$CFG->wwwroot`, so a default installation answers nothing else on a content host.
A site with `$CFG->reverseproxy` enabled accepts any host, and would serve every
Moodle page, the login page included, on the content hosts. Restrict the path in the
web server in both cases.

The web server must pass the host the browser asked for (`Host` header) to PHP: the
endpoint answers only when that host is the content host of the activity requested.

### Nginx with PHP-FPM

```nginx
server {
    listen 443 ssl;
    server_name "~^m[0-9a-f]{40}\.exelearningusercontent\.com$";
    ssl_certificate     /etc/letsencrypt/live/exelearningusercontent.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/exelearningusercontent.com/privkey.pem;

    # The document root of the Moodle server block (Moodle 5.1 and later: .../public).
    root /var/www/moodle;

    location ^~ /mod/exelearning/content.php/ {
        fastcgi_split_path_info ^(/mod/exelearning/content\.php)(/.+)$;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param SCRIPT_NAME     $fastcgi_script_name;
        fastcgi_param PATH_INFO       $fastcgi_path_info;
        fastcgi_pass unix:/run/php/php-fpm.sock;
    }

    location / {
        return 404;
    }
}
```

### Nginx as a reverse proxy

```nginx
server {
    listen 443 ssl;
    server_name "~^m[0-9a-f]{40}\.exelearningusercontent\.com$";
    ssl_certificate     /etc/letsencrypt/live/exelearningusercontent.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/exelearningusercontent.com/privkey.pem;

    location ^~ /mod/exelearning/content.php/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    }

    location / {
        return 404;
    }
}
```

### Other web servers

The rule is the same: a virtual host for `*.<content domain>` with the Moodle
document root, that preserves the `Host` header and refuses every path that does
not start with `/mod/exelearning/content.php/`. In Apache that is a `<VirtualHost>`
with `ServerAlias *.exelearningusercontent.com` and `AcceptPathInfo On`. Only the
Nginx configurations above were tested.

### Moodle in a subdirectory

Content URLs keep the path of `$CFG->wwwroot`
(`https://<label>.exelearningusercontent.com/moodle/mod/exelearning/content.php/…`).
Use the same prefix in the `location`.

### Sharing the domain with eXeLearning

The `server_name` above matches only the plugin's labels (`m` and 40 hexadecimal
digits). eXeLearning's content hosts start with `v` or `p`, so each application can
have its own server block, or its own proxy rule, on one content domain. Two Moodle
sites cannot be told apart by the label; give each its own content domain or
subdomain (`*.site-a.exelearningusercontent.com`).

## Check that it works

1. Open an activity. In the browser developer tools the `src` of the iframe starts
   with `https://m<40 characters>.exelearningusercontent.com/`.
2. Answer a graded question and check that the grade reaches the gradebook.
3. With the URL of the iframe:

   ```bash
   # 200, with a Content-Security-Policy header and no Set-Cookie
   curl -sD - -o /dev/null 'https://m….exelearningusercontent.com/mod/exelearning/content.php/<token>/player.html'
   # 404: content hosts serve content only
   curl -s -o /dev/null -w '%{http_code}\n' 'https://m….exelearningusercontent.com/login/index.php'
   # 404: the endpoint does not answer on the Moodle host
   curl -s -o /dev/null -w '%{http_code}\n' 'https://moodle.example.org/mod/exelearning/content.php/<token>/player.html'
   ```

If the content host cannot be reached, the activity shows "The content could not be
loaded from the content domain." It does not fall back to the Moodle origin: once a
content domain is set, `pluginfile.php` no longer serves package content. Check DNS,
the certificate and that the web server passes the host through.

## What changes

| | Without a content domain | With a content domain |
|---|---|---|
| Origin of the package | the Moodle site | `https://<label>.<content domain>`, one per activity |
| Moodle page, cookies, session key | reachable by the package | not reachable |
| Authenticated requests to Moodle from the package | possible | not possible |
| Navigating the Moodle tab away, modal dialogs | possible through the Moodle page | blocked by the sandbox |
| `localStorage`, IndexedDB of the package | shared with Moodle and every other package | separate for each activity |
| Package URL opened outside the iframe | runs in the Moodle origin | runs in the content origin, sandboxed |
| Grades and attempts | recorded | recorded |

## How it works

- **One origin per activity.** The label is derived, with a secret that only the
  plugin holds, from the module context and the origin of the Moodle site. A content
  host answers for one activity of one Moodle site; nobody can choose a label.
- **No session on content hosts.** `content.php` never reads or sets a cookie. The
  URL carries a token issued by `view.php` that names the user and the activity. On
  each request the endpoint checks the token, that the host is the one of that
  activity, and that the user may view the activity at that moment. The token lasts
  as long as an idle Moodle session; it is not a Moodle user key and is worth nothing
  outside the activity it was issued for.
- **The player page.** The iframe loads a small page of the plugin on the content
  origin, which frames the package. The SCORM 1.2 runtime of the package finds its
  `API` there, as it found it in the Moodle page before, and the tracker reads the
  package document there. Nothing in the package changes.
- **Saving grades.** The player page posts the data to save to the Moodle page. That
  page accepts a message only from the activity iframe and only from the activity's
  content origin, and makes the `track.php` request itself, so the session key never
  leaves Moodle. The server validates the data exactly as before.

## Limits

- The token is part of the content URL, so the package can read it and the web server
  records it in the access log of the content hosts. It reveals the numeric ids of the
  user and of the activity context, and lets its holder fetch the files of that
  activity as that user until it expires. It gives no access to Moodle.
- A failed save is retried by the Moodle page and sent again when the page is left;
  the package itself is told the data was saved as soon as it is handed over.
- Access that exists only in the Moodle session does not reach the content host. A
  guest who entered a course guest-access password sees the error instead of the
  package; guest access without a password works.
- The embedded editor and its preview are not moved to the content domain.
- Two activities are different origins but the same site unless the content domain is
  in the [Public Suffix List](https://publicsuffix.org/). Origin isolation (page,
  storage, cookies set by scripts) does not depend on that.
- Regenerating the plugin's secret (the `contentsecret` setting) changes every content
  origin; whatever a package stored in the browser under the old origin is no longer
  reachable.
- When Moodle allows being embedded in other sites (`allowframembedding`), the content
  cannot list its allowed ancestors and does not restrict them.
- Browsers may keep package files they cached from the Moodle origin before the
  content domain was set, for as long as `filelifetime` allows.
