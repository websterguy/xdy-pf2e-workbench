This directory contains types generated from the pathfinder 2 system by applying this:

```
Index: tsconfig.json
IDEA additional info:
Subsystem: com.intellij.openapi.diff.impl.patch.CharsetEP
<+>UTF-8
===================================================================
diff --git a/tsconfig.json b/tsconfig.json
--- a/tsconfig.json	(revision 5c91a1fdeb736f816e747b8fcd654b2e2f4f419b)
+++ b/tsconfig.json	(date 1647159584874)
@@ -3,7 +3,10 @@
         "target": "es2018",
         "module": "commonjs",
         "lib": ["esnext", "dom"],
-        "noEmit": true,
+//        "noEmit": true,
+        "declaration": true,
+        "declarationDir": "./dist/types",
+        "emitDeclarationOnly": true,
         "strict": true,
         "noFallthroughCasesInSwitch": true,
         "noImplicitOverride": true,
```

And then running this:
````
run node_modules/.bin/tsc
```

As well as foundry types copied from pf2e-monster-import (made by doing the above on foundry?)
