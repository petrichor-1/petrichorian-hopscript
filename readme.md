# Petrichorian hopscript
This is an idea for [hopscript](https://forum.gethopscotch.com/t/hopscript-hopscotch-text-language-concept/61544?u=petrichor) inspired by Tri-Angle's [Hopscotch Textual Notation](https://forum.gethopscotch.com/t/hopscotch-notation-compiler/66230?u=petrichor).

Currently, there are three major elements in this repository:
`hopscotchify.js` – A program to convert hopscript to a hopscotch project. Just run `node hopscotchify.js <hopscriptfile.htn>` and it will output the hopscotch json (or an error message.)
`dehopscotchify.js` – A program to convert hopscotch projects to hopscript. Just run `node dehopscotchify.js <hopscotchfile.hopscotch>` and it will output the hopscript code.
`vscode/petrichorianhopscript` – An extension for visual studio code to provide some basic syntax highlighting and limited completions.

For any of these to work, you first need to run `npm install` to install some dependencies used for parsing the hopscript.

## A short tutorial
The examples in `samples/petrichor` should contain examples of pretty much every feature currently supported, if it is not covered here.
The contents of `samples/tri-angle` are not valid and will not work currently, but were used as a reference to create the language.
### Objects
To create an object, start by specifying the type of object you are creating, followed by its name and a colon:
```phopscript
bear phillip:
```

You can also specify things such as the location, rotation, size, and text content of text objects using parentheses:
```phopscript
text super_cool_message(x_position: 300, y_position: 200, rotation: 30, resize_scale: 3, text: "Hello, this is a super cool message!"):
```

On the next line after this, indent one level and include the object's code:
```phopscript
monkey monkey:
	#Empty objects are not allowed, so at the very least include a comment!
```
In objects, you can include comments, rules, custom rules, and, as long as it is before any rules or custom rules, set blocks:
```phopscript
banyan tree:
	Self.vertical_velocity = 0
	#You can include variable assignments here because it is before any rules
	local_variable = 10
	When game_starts:
		set_angle(10)
	#You can no longer include assignment blocks here, but you can still add comments, they just won't show up in
	#    the final Hopscotch project!
```

### Custom rules
To create custom rules, which you can include inside of objects, other custom rules, or as their own top-level container (as long as you are defining their contents), start a line with `custom_rule` followed by the custom rule's name:
```phopscript
custom_rule draw_like_a_pen
```

You can give the custom rule parameters using parentheses:
```phopscript
custom_rule gradient_between(color1: "yellow", color2: "blue")
```

To define the custom rule's content, which you must do exactly once for each custom rule, end the line with a colon and indent the next lines. Custom rules can contain exactly the same things as objects:
```phopscript
custom_rule ensure_clone_count(clone_count: 7):
	#The values of parameters in the definition of custom rules will become their default values
	#    in the final Hopscotch project!
	When Self.total_clones < clone_count:
		create_a_clone_of_this_object
```

### Rules
To create rules, which you can include inside of objects or custom rules, start the line (after indentation) with `When` followed by the condition and a colon.
```phopscript
When game_starts:
```

You can also include parameters with parentheses:
```phopscript
When is_tapped(Self):
```

After this, indent the next line and include blocks.

### Blocks
To create blocks, just put the block name, in snake_case:
```phopscript
create_a_clone_of_this_object
```

You can provide arguments to blocks with parentheses:
```phopscript
join("Hello, ", with: "world!")
```

By default it is important that you use the correct label for arguments, however you can provide the `--ignoreParameterLabels` to hopscotchify.js to disable this, though that is not recommended.

Some blocks also have binary operator forms:
```phopscript
72 + Self.scroll_offset
```