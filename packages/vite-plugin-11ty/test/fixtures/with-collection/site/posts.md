---
title: Posts
permalink: /posts/
---

# All Posts

<ul>
{% for p in collections.post %}
<li>{{ p.data.title }}</li>
{% endfor %}
</ul>
