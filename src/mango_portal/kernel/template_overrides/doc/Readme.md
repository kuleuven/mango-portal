# ManGO template override system

As one of the core features, the ManGO portal has a flexible system of dealing with templates. The default templates for a kernel module or even custom plugin/extension jinja2 templates can make use of this.

Basically, the default template can be overriden by a custom template based on a set of rules stored in a dedicated configuration file. The format of this configuration file is YAML multidoc (each subdocument has the rules for a specific zone, and there is also a catch-all or global set of rules that applies to all zones the ManGO portal instance is serving)
