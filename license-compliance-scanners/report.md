# Open Source License Compliance Report

- **Project Path**: `/Users/yundongsoftware/Documents/projects/dogfoodings0601/license-compliance-scanners/my-repo`
- **Scanned Files**: 3
- **Total Dependencies**: 18

## Summary

| Risk Level | Count |
|------------|-------|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 5 |
| LOW | 0 |

## License Conflicts

### [MEDIUM] MIT ↔ GPL-3.0-only

> MIT code can be included in GPLv3 projects, but the combined work will be under GPLv3 (copyleft infection)

**Packages Involved:**

- `commander@11.1.0` (MIT) [npm]
  - Chain: `test-project → commander`
- `ts-node@10.9.2` (MIT) [npm]
  - Chain: `test-project → ts-node`
- `@types/node@20.10.0` (MIT) [npm]
  - Chain: `test-project → @types/node`
- `test-gpl-lib@2.0.0` (GPL-3.0-only) [npm]
  - Chain: `test-project → test-gpl-lib`

### [MEDIUM] UNKNOWN ↔ MIT

> Cannot verify compatibility - one or more licenses are unknown

**Packages Involved:**

- `github.com/gin-gonic/gin@v1.9.1` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/gin-gonic/gin`
- `github.com/spf13/cobra@v1.8.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/spf13/cobra`
- `golang.org/x/crypto@v0.17.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → golang.org/x/crypto`
- `github.com/mitchellh/go-homedir@v1.1.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/mitchellh/go-homedir`
- `gopkg.in/yaml.v3@v3.0.1` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → gopkg.in/yaml.v3`
- `requests@2.31.0` (UNKNOWN) [pip]
  - Chain: `my-repo → requests`
- `flask@2.0.0` (UNKNOWN) [pip]
  - Chain: `my-repo → flask`
- `django@4.2.0` (UNKNOWN) [pip]
  - Chain: `my-repo → django`
- `numpy@1.24.0` (UNKNOWN) [pip]
  - Chain: `my-repo → numpy`
- `pandas@latest` (UNKNOWN) [pip]
  - Chain: `my-repo → pandas`
- `cryptography@latest` (UNKNOWN) [pip]
  - Chain: `my-repo → cryptography`
- `test-gpl-package@1.0.0` (UNKNOWN) [pip]
  - Chain: `my-repo → test-gpl-package`
- `commander@11.1.0` (MIT) [npm]
  - Chain: `test-project → commander`
- `ts-node@10.9.2` (MIT) [npm]
  - Chain: `test-project → ts-node`
- `@types/node@20.10.0` (MIT) [npm]
  - Chain: `test-project → @types/node`

### [MEDIUM] UNKNOWN ↔ Apache-2.0

> Cannot verify compatibility - one or more licenses are unknown

**Packages Involved:**

- `github.com/gin-gonic/gin@v1.9.1` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/gin-gonic/gin`
- `github.com/spf13/cobra@v1.8.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/spf13/cobra`
- `golang.org/x/crypto@v0.17.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → golang.org/x/crypto`
- `github.com/mitchellh/go-homedir@v1.1.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/mitchellh/go-homedir`
- `gopkg.in/yaml.v3@v3.0.1` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → gopkg.in/yaml.v3`
- `requests@2.31.0` (UNKNOWN) [pip]
  - Chain: `my-repo → requests`
- `flask@2.0.0` (UNKNOWN) [pip]
  - Chain: `my-repo → flask`
- `django@4.2.0` (UNKNOWN) [pip]
  - Chain: `my-repo → django`
- `numpy@1.24.0` (UNKNOWN) [pip]
  - Chain: `my-repo → numpy`
- `pandas@latest` (UNKNOWN) [pip]
  - Chain: `my-repo → pandas`
- `cryptography@latest` (UNKNOWN) [pip]
  - Chain: `my-repo → cryptography`
- `test-gpl-package@1.0.0` (UNKNOWN) [pip]
  - Chain: `my-repo → test-gpl-package`
- `typescript@5.3.3` (Apache-2.0) [npm]
  - Chain: `test-project → typescript`
- `sub-dep@1.0.0` (Apache-2.0) [npm]
  - Chain: `test-project → test-gpl-lib → sub-dep`

### [MEDIUM] UNKNOWN ↔ GPL-3.0-only

> Cannot verify compatibility - one or more licenses are unknown

**Packages Involved:**

- `github.com/gin-gonic/gin@v1.9.1` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/gin-gonic/gin`
- `github.com/spf13/cobra@v1.8.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/spf13/cobra`
- `golang.org/x/crypto@v0.17.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → golang.org/x/crypto`
- `github.com/mitchellh/go-homedir@v1.1.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/mitchellh/go-homedir`
- `gopkg.in/yaml.v3@v3.0.1` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → gopkg.in/yaml.v3`
- `requests@2.31.0` (UNKNOWN) [pip]
  - Chain: `my-repo → requests`
- `flask@2.0.0` (UNKNOWN) [pip]
  - Chain: `my-repo → flask`
- `django@4.2.0` (UNKNOWN) [pip]
  - Chain: `my-repo → django`
- `numpy@1.24.0` (UNKNOWN) [pip]
  - Chain: `my-repo → numpy`
- `pandas@latest` (UNKNOWN) [pip]
  - Chain: `my-repo → pandas`
- `cryptography@latest` (UNKNOWN) [pip]
  - Chain: `my-repo → cryptography`
- `test-gpl-package@1.0.0` (UNKNOWN) [pip]
  - Chain: `my-repo → test-gpl-package`
- `test-gpl-lib@2.0.0` (GPL-3.0-only) [npm]
  - Chain: `test-project → test-gpl-lib`

### [MEDIUM] UNKNOWN ↔ UNKNOWN

> 12 package(s) with unknown licenses - manual review required

**Packages Involved:**

- `github.com/gin-gonic/gin@v1.9.1` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/gin-gonic/gin`
- `github.com/spf13/cobra@v1.8.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/spf13/cobra`
- `golang.org/x/crypto@v0.17.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → golang.org/x/crypto`
- `github.com/mitchellh/go-homedir@v1.1.0` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → github.com/mitchellh/go-homedir`
- `gopkg.in/yaml.v3@v3.0.1` (UNKNOWN) [go]
  - Chain: `github.com/example/test-project → gopkg.in/yaml.v3`
- `requests@2.31.0` (UNKNOWN) [pip]
  - Chain: `my-repo → requests`
- `flask@2.0.0` (UNKNOWN) [pip]
  - Chain: `my-repo → flask`
- `django@4.2.0` (UNKNOWN) [pip]
  - Chain: `my-repo → django`
- `numpy@1.24.0` (UNKNOWN) [pip]
  - Chain: `my-repo → numpy`
- `pandas@latest` (UNKNOWN) [pip]
  - Chain: `my-repo → pandas`
- `cryptography@latest` (UNKNOWN) [pip]
  - Chain: `my-repo → cryptography`
- `test-gpl-package@1.0.0` (UNKNOWN) [pip]
  - Chain: `my-repo → test-gpl-package`

## Dependencies by License

### UNKNOWN (Unknown License)

- **Category**: unknown
- **Copyleft Strength**: none
- **Package Count**: 12

- `github.com/gin-gonic/gin@v1.9.1` [go]
- `github.com/spf13/cobra@v1.8.0` [go]
- `golang.org/x/crypto@v0.17.0` [go]
- `github.com/mitchellh/go-homedir@v1.1.0` [go]
- `gopkg.in/yaml.v3@v3.0.1` [go]
- `requests@2.31.0` [pip]
- `flask@2.0.0` [pip]
- `django@4.2.0` [pip]
- `numpy@1.24.0` [pip]
- `pandas@latest` [pip]
- `cryptography@latest` [pip]
- `test-gpl-package@1.0.0` [pip]

### MIT (MIT License)

- **Category**: permissive
- **Copyleft Strength**: none
- **Package Count**: 3

- `commander@11.1.0` [npm]
- `ts-node@10.9.2` [npm]
- `@types/node@20.10.0` [npm]

### Apache-2.0 (Apache License 2.0)

- **Category**: permissive
- **Copyleft Strength**: none
- **Package Count**: 2

- `typescript@5.3.3` [npm]
- `sub-dep@1.0.0` [npm]

### GPL-3.0-only (GNU General Public License v3.0 only)

- **Category**: copyleft
- **Copyleft Strength**: strong
- **Package Count**: 1

- `test-gpl-lib@2.0.0` [npm]
