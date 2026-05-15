'use strict';

/**
 * Standalone anatomy visualization module for Figma plugins.
 * No import/export — paste or concatenate into main code.
 */
var AnatomyGenerator = (function () {
  var ANATOMY_LAYOUT = {
    markerSize: 24,
    markerOffset: 20,
    connectorThickness: 1,
    framePadding: 40,
    listGap: 120,
    listWidth: 260,
  };

  function hexToRgb(hex) {
    var s = String(hex || '').replace(/^#/, '');
    if (s.length === 3) {
      s =
        s.charAt(0) +
        s.charAt(0) +
        s.charAt(1) +
        s.charAt(1) +
        s.charAt(2) +
        s.charAt(2);
    }
    var n = parseInt(s, 16);
    if (isNaN(n) || s.length !== 6) {
      return { r: 0, g: 0, b: 0 };
    }
    return {
      r: ((n >> 16) & 255) / 255,
      g: ((n >> 8) & 255) / 255,
      b: (n & 255) / 255,
    };
  }

  var ANATOMY_COLORS = {
    accent: hexToRgb('#FC8507'),
    markerText: { r: 1, g: 1, b: 1 },
    listText: hexToRgb('#4E4E4E'),
    background: hexToRgb('#F7F7F7'),
  };

  var DEFAULT_OPTIONS = {
    maxItems: 32,
    maxDepth: 8,
    sortMode: 'tree',
    includeHidden: false,
    includeContainer: false,

    framePadding: ANATOMY_LAYOUT.framePadding,
    listGap: ANATOMY_LAYOUT.listGap,
    listWidth: ANATOMY_LAYOUT.listWidth,

    markerSize: ANATOMY_LAYOUT.markerSize,
    markerOffset: ANATOMY_LAYOUT.markerOffset,
    connectorThickness: ANATOMY_LAYOUT.connectorThickness,
    markerRadius: 12,

    markerColor: ANATOMY_COLORS.accent,
    markerTextColor: ANATOMY_COLORS.markerText,
    connectorColor: ANATOMY_COLORS.accent,

    listTextColor: ANATOMY_COLORS.listText,

    fontRegular: { family: 'PT Sans', style: 'Regular' },
    fontBold: { family: 'PT Sans', style: 'Bold' },

    scale: 1,

    backgroundColor: ANATOMY_COLORS.background,
    frameFillColor: ANATOMY_COLORS.background,

    useComponentPropertyNames: true,
  };

  function mergeOptions(options) {
    var base = {};
    var k;
    for (k in DEFAULT_OPTIONS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_OPTIONS, k)) {
        base[k] = DEFAULT_OPTIONS[k];
      }
    }
    if (options && typeof options === 'object') {
      for (k in options) {
        if (Object.prototype.hasOwnProperty.call(options, k) && options[k] !== undefined) {
          base[k] = options[k];
        }
      }
    }
    return base;
  }

  function nodeHasChildren(node) {
    return node && 'children' in node && Array.isArray(node.children);
  }

  function normalizeName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function includesAny(value, patterns) {
    var i;
    for (i = 0; i < patterns.length; i++) {
      if (value.indexOf(patterns[i]) !== -1) return true;
    }
    return false;
  }

  function isServiceNode(node) {
    var name = String((node && node.name) || '');

    if (name.charAt(0) === '_') return true;

    var servicePrefixes = [
      'Padding overlay',
      'Gap overlay',
      'Child overlay',
      'Preview /',
      'Anatomy marker',
      'Anatomy connector',
      'Anatomy list',
      'Padding measure',
      'Gap measure',
      'Padding value',
      'Gap value',
      'Value square',
      'Container preview card',
      'Padding overlay container',
    ];

    var j;
    for (j = 0; j < servicePrefixes.length; j++) {
      if (name.indexOf(servicePrefixes[j]) === 0) return true;
    }

    var n = normalizeName(name);
    if (n.indexOf('value square') !== -1) return true;
    if (n.indexOf('measure fill') !== -1) return true;

    return false;
  }

  function shouldConsiderNode(node, options) {
    if (!node) return false;

    if (!options.includeHidden && 'visible' in node && node.visible === false) {
      return false;
    }

    if (isServiceNode(node)) {
      return false;
    }

    if (typeof node.width !== 'number' || typeof node.height !== 'number') {
      return false;
    }

    if (node.width <= 0 || node.height <= 0) {
      return false;
    }

    return true;
  }

  function isComponentLikeNode(node) {
    if (!node) return false;
    return (
      node.type === 'INSTANCE' ||
      node.type === 'COMPONENT' ||
      node.type === 'COMPONENT_SET'
    );
  }

  function isTextNode(node) {
    return node && node.type === 'TEXT';
  }

  function isLineLikeNode(node) {
    if (!node) return false;
    var name = normalizeName(node.name);

    if (node.type === 'LINE') return true;

    if (
      (node.type === 'VECTOR' || node.type === 'RECTANGLE') &&
      includesAny(name, [
        'divider',
        'separator',
        'line',
        'border',
        'разделитель',
        'линия',
      ])
    ) {
      return true;
    }

    if (
      includesAny(name, [
        'divider',
        'separator',
        'line',
        'border',
        'разделитель',
        'линия',
      ])
    ) {
      return true;
    }

    return false;
  }

  function isAtomicByName(node) {
    if (!node) return false;
    var name = normalizeName(node.name);

    return includesAny(name, [
      'icon',
      'икон',
      'label',
      'лейбл',
      'body',
      'wobbler',
      'tag',
      'badge',
      'avatar',
      'image',
      'media',
      'checkbox',
      'radio',
      'switch',
      'control',
      'button',
      'link',
      'input',
      'title',
      'subtitle',
      'description',
      'caption',
    ]);
  }

  function isStructuralContainer(node) {
    if (!node) return false;

    var name = normalizeName(node.name);

    if (node.type === 'TEXT') return false;

    if (isComponentLikeNode(node)) return false;

    if (
      includesAny(name, [
        'content',
        'container',
        'wrapper',
        'layout',
        'main',
        'center',
        'header',
        'footer',
        'text',
        'body container',
        'group',
      ])
    ) {
      return true;
    }

    if (
      node.type === 'FRAME' ||
      node.type === 'GROUP' ||
      node.type === 'SECTION'
    ) {
      return true;
    }

    return false;
  }

  function getDecompositionRole(node) {
    if (!node) return 'skip';

    if (isServiceNode(node)) return 'skip';

    if (isComponentLikeNode(node)) {
      return 'atomic';
    }

    if (isTextNode(node)) {
      return 'atomic';
    }

    if (isLineLikeNode(node)) {
      return 'atomic';
    }

    if (isAtomicByName(node)) {
      return 'atomic';
    }

    if (isStructuralContainer(node)) {
      return 'container';
    }

    if (
      node.type === 'VECTOR' ||
      node.type === 'BOOLEAN_OPERATION' ||
      node.type === 'POLYGON' ||
      node.type === 'STAR'
    ) {
      return 'skip';
    }

    if ('children' in node && Array.isArray(node.children)) {
      return 'container';
    }

    return 'atomic';
  }

  function decomposeAnatomyTree(rootNode, options) {
    var maxDepth = options.maxDepth != null ? options.maxDepth : 8;

    function walk(node, depth, parent) {
      if (!node || depth > maxDepth) {
        return [];
      }

      if (node !== rootNode && !shouldConsiderNode(node, options)) {
        return [];
      }

      var role = node === rootNode ? 'container' : getDecompositionRole(node);

      if (role === 'skip') {
        return [];
      }

      if (role === 'atomic') {
        return [
          {
            node: node,
            parent: parent,
            depth: depth,
            role: role,
          },
        ];
      }

      var childResults = [];

      if ('children' in node && Array.isArray(node.children)) {
        var c;
        for (c = 0; c < node.children.length; c++) {
          var child = node.children[c];
          var decomposed = walk(child, depth + 1, node);
          var d;
          for (d = 0; d < decomposed.length; d++) {
            childResults.push(decomposed[d]);
          }
        }
      }

      if (childResults.length > 0) {
        return childResults;
      }

      if (node !== rootNode && shouldConsiderNode(node, options)) {
        return [
          {
            node: node,
            parent: parent,
            depth: depth,
            role: 'fallback-container',
          },
        ];
      }

      return [];
    }

    return walk(rootNode, 0, null);
  }

  function sortAnatomyCandidates(candidates, options) {
    if ((options.sortMode || 'tree') === 'tree') {
      return candidates;
    }

    return candidates.slice().sort(function (a, b) {
      var aBox = a.node.absoluteBoundingBox;
      var bBox = b.node.absoluteBoundingBox;

      if (!aBox || !bBox) return 0;

      var yDiff = aBox.y - bBox.y;

      if (Math.abs(yDiff) > 8) {
        return yDiff;
      }

      return aBox.x - bBox.x;
    });
  }

  function removeDuplicateCandidates(candidates) {
    var seen = {};
    var result = [];
    var i;
    for (i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (!candidate || !candidate.node) continue;

      var id = candidate.node.id;
      if (seen[id]) continue;
      seen[id] = true;
      result.push(candidate);
    }
    return result;
  }

  // Component property name resolution is best-effort.
  // Direct componentPropertyReferences are preferred.
  // Heuristic matching is only used when there is a single safe candidate.

  function normalizePropertyName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[#!]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  // Examples:
  // "<- Content left" -> "Content left"
  // "Content right ->" -> "Content right"
  // "← Icon left" -> "Icon left"
  // "Icon right →" -> "Icon right"
  // "Top description#123:456" -> "Top description"
  function cleanDisplayName(name) {
    return String(name || '')
      .replace(/#\d+:\d+/g, '')
      .replace(/[#!]$/g, '')
      .replace(/^\s*(<-|←|<|‹|«|-\s*>|→)\s*/g, '')
      .replace(/\s*(->|→|>|›|»|<-\s*|←)\s*$/g, '')
      .replace(/^\s*[-–—]+\s*/g, '')
      .replace(/\s*[-–—]+\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanComponentPropertyName(name) {
    return cleanDisplayName(name);
  }

  function getNodeNamePath(node, rootLimit) {
    var names = [];
    var current = node;

    while (current && current !== rootLimit) {
      if (current.name) {
        names.unshift(current.name);
      }
      current = current.parent;
    }

    return names;
  }

  function getBooleanPropertyNames(metadata) {
    var definitions =
      metadata && metadata.mainComponentPropertyDefinitions
        ? metadata.mainComponentPropertyDefinitions
        : {};

    var keys = Object.keys(definitions);
    var result = [];
    var i;
    for (i = 0; i < keys.length; i++) {
      var propertyName = keys[i];
      var definition = definitions[propertyName];
      if (definition && definition.type === 'BOOLEAN') {
        result.push(propertyName);
      }
    }
    return result;
  }

  function getDirectComponentPropertyNameForNode(node) {
    try {
      if (node && node.componentPropertyReferences) {
        var refs = node.componentPropertyReferences;
        var refValues = [];
        var k;
        for (k in refs) {
          if (Object.prototype.hasOwnProperty.call(refs, k) && refs[k]) {
            refValues.push(refs[k]);
          }
        }
        if (refValues.length > 0) {
          return String(refValues[0]);
        }
      }
      return null;
    } catch (error) {
      console.warn('Cannot read direct component property reference for node', error);
      return null;
    }
  }

  function findBestComponentPropertyNameForNode(node, metadata, rootLimit) {
    if (!metadata) return null;

    var pi;

    var directName = getDirectComponentPropertyNameForNode(node);
    if (directName) {
      return cleanComponentPropertyName(directName);
    }

    var booleanPropertyNames = getBooleanPropertyNames(metadata);
    if (!booleanPropertyNames.length) {
      return null;
    }

    if (rootLimit) {
      var pathSegments = getNodeNamePath(node, rootLimit).map(normalizePropertyName);
      for (pi = 0; pi < booleanPropertyNames.length; pi++) {
        var propNm = booleanPropertyNames[pi];
        var normalizedProp = normalizePropertyName(propNm);
        if (pathSegments.indexOf(normalizedProp) !== -1) {
          return cleanComponentPropertyName(propNm);
        }
      }
    }

    var nodeName = normalizePropertyName(node.name);

    var genericLayerNames = [
      'label',
      'text',
      'icon',
      'description',
      'body',
      'content',
    ];

    var isGenericName = genericLayerNames.indexOf(nodeName) !== -1;

    var byName = null;
    for (pi = 0; pi < booleanPropertyNames.length; pi++) {
      var pName = booleanPropertyNames[pi];
      var normalizedProperty = normalizePropertyName(pName);
      if (normalizedProperty.indexOf(nodeName) !== -1 && nodeName.length > 2) {
        byName = pName;
        break;
      }
    }

    if (byName && isGenericName) {
      return cleanComponentPropertyName(byName);
    }

    if (isGenericName) {
      var semanticCandidates = [];
      for (pi = 0; pi < booleanPropertyNames.length; pi++) {
        var propName2 = booleanPropertyNames[pi];
        var np2 = normalizePropertyName(propName2);
        if (
          np2.indexOf('top') !== -1 ||
          np2.indexOf('bottom') !== -1 ||
          np2.indexOf('left') !== -1 ||
          np2.indexOf('right') !== -1 ||
          np2.indexOf('leading') !== -1 ||
          np2.indexOf('trailing') !== -1 ||
          np2.indexOf('description') !== -1 ||
          np2.indexOf('icon') !== -1 ||
          np2.indexOf('label') !== -1
        ) {
          semanticCandidates.push(propName2);
        }
      }

      if (semanticCandidates.length === 1) {
        return cleanComponentPropertyName(semanticCandidates[0]);
      }
    }

    return null;
  }

  async function getComponentPropertyMetadata(sourceNode) {
    var metadata = {
      instanceProperties: {},
      mainComponentPropertyDefinitions: {},
      propertyNames: [],
    };

    try {
      if (sourceNode.type === 'INSTANCE' && sourceNode.componentProperties) {
        metadata.instanceProperties = sourceNode.componentProperties || {};
      }

      if (
        sourceNode.type === 'INSTANCE' &&
        typeof sourceNode.getMainComponentAsync === 'function'
      ) {
        var mainComponent = await sourceNode.getMainComponentAsync();

        if (mainComponent && mainComponent.componentPropertyDefinitions) {
          metadata.mainComponentPropertyDefinitions =
            mainComponent.componentPropertyDefinitions || {};
        }
      }

      if (
        (sourceNode.type === 'COMPONENT' ||
          sourceNode.type === 'COMPONENT_SET') &&
        sourceNode.componentPropertyDefinitions
      ) {
        metadata.mainComponentPropertyDefinitions =
          sourceNode.componentPropertyDefinitions || {};
      }

      metadata.propertyNames = Object.keys(
        metadata.mainComponentPropertyDefinitions || {}
      );

      return metadata;
    } catch (error) {
      console.warn('Cannot read component property metadata', error);
      return metadata;
    }
  }

  function getDisplayAnatomyName(node, role, options) {
    void role;
    if (!node) {
      return 'Element';
    }

    if (options && options.useComponentPropertyNames !== false) {
      var propertyName = findBestComponentPropertyNameForNode(
        node,
        options.componentPropertyMetadata,
        options.anatomyRootNodeForNames
      );

      if (propertyName) {
        return cleanDisplayName(propertyName);
      }
    }

    var rawName = String((node && node.name) || '').trim();
    var cleanedLayerName = cleanDisplayName(rawName);

    if (cleanedLayerName) return cleanedLayerName;

    if (node.type === 'TEXT') return 'Text';
    if (node.type === 'INSTANCE') return 'Component';
    if (node.type === 'LINE') return 'Divider';

    return 'Element';
  }

  function collectSemanticAnatomyItems(rootNode, options) {
    var mergedOptions = mergeOptions(options || {});
    mergedOptions.maxDepth =
      mergedOptions.maxDepth != null ? mergedOptions.maxDepth : 8;
    mergedOptions.sortMode =
      mergedOptions.sortMode != null ? mergedOptions.sortMode : 'tree';

    mergedOptions.anatomyRootNodeForNames = rootNode;

    var candidates = decomposeAnatomyTree(rootNode, mergedOptions);
    var deduped = removeDuplicateCandidates(candidates);
    var sorted = sortAnatomyCandidates(deduped, mergedOptions);

    var maxTotal = mergedOptions.maxItems;
    var cap = maxTotal;
    if (mergedOptions.includeContainer) {
      cap = Math.max(0, maxTotal - 1);
    }

    var sliced = sorted.slice(0, cap);

    var items = sliced.map(function (candidate, index) {
      return {
        index: index + 1,
        id: candidate.node.id,
        name: getDisplayAnatomyName(
          candidate.node,
          candidate.role,
          mergedOptions
        ),
        type: candidate.node.type,
        role: candidate.role,
        depth: candidate.depth,
        bounds: getRelativeBounds(candidate.node, rootNode),
        node: candidate.node,
      };
    });

    if (mergedOptions.includeContainer) {
      var containerRow = {
        index: 1,
        id: rootNode.id,
        name: 'Container',
        type: rootNode.type,
        role: 'semantic-container',
        depth: 0,
        bounds: {
          x: 0,
          y: 0,
          width: rootNode.width,
          height: rootNode.height,
        },
        node: rootNode,
      };
      var j;
      for (j = 0; j < items.length; j++) {
        items[j].index = j + 2;
      }
      return [containerRow].concat(items);
    }

    return items;
  }

  function collectAnatomyItems(rootNode, options) {
    return collectSemanticAnatomyItems(rootNode, options);
  }

  function getRelativeBounds(node, rootNode) {
    var nodeBox = node.absoluteBoundingBox;
    var rootBox = rootNode.absoluteBoundingBox;

    if (nodeBox && rootBox) {
      return {
        x: nodeBox.x - rootBox.x,
        y: nodeBox.y - rootBox.y,
        width: nodeBox.width,
        height: nodeBox.height,
      };
    }

    return {
      x: node.x || 0,
      y: node.y || 0,
      width: node.width || 0,
      height: node.height || 0,
    };
  }

  function getNodeLocalBounds(node) {
    return {
      x: node.x || 0,
      y: node.y || 0,
      width: node.width || 0,
      height: node.height || 0,
    };
  }

  function getItemAnchorSide(itemBounds, rootBounds) {
    var itemCenterX = itemBounds.x + itemBounds.width / 2;
    var itemCenterY = itemBounds.y + itemBounds.height / 2;

    var distLeft = itemCenterX;
    var distRight = rootBounds.width - itemCenterX;
    var distTop = itemCenterY;
    var distBottom = rootBounds.height - itemCenterY;

    var distances = [
      { side: 'left', value: distLeft },
      { side: 'right', value: distRight },
      { side: 'top', value: distTop },
      { side: 'bottom', value: distBottom },
    ];

    distances.sort(function (a, b) {
      return a.value - b.value;
    });

    return distances[0].side;
  }

  function isVerticalPointerSide(side) {
    return side === 'top' || side === 'bottom';
  }

  function isHorizontalPointerSide(side) {
    return side === 'left' || side === 'right';
  }

  function getPointerAlignmentLines(rootBounds, options) {
    var markerSize =
      options.markerSize != null ? options.markerSize : ANATOMY_LAYOUT.markerSize;
    var markerOffset =
      options.markerOffset != null ? options.markerOffset : ANATOMY_LAYOUT.markerOffset;

    return {
      topY: rootBounds.y - markerOffset - markerSize,
      bottomY: rootBounds.y + rootBounds.height + markerOffset,
      leftX: rootBounds.x - markerOffset - markerSize,
      rightX: rootBounds.x + rootBounds.width + markerOffset,
    };
  }

  function getPointerGeometry(pointerData, rootBounds, alignmentLines, options) {
    void rootBounds;
    var markerSize =
      options.markerSize != null ? options.markerSize : ANATOMY_LAYOUT.markerSize;
    var side = pointerData.side;
    var itemBounds = pointerData.itemBounds;

    var itemCenterX = itemBounds.x + itemBounds.width / 2;
    var itemCenterY = itemBounds.y + itemBounds.height / 2;

    if (side === 'top') {
      var pointerX = itemCenterX - markerSize / 2;
      var pointerY = alignmentLines.topY;
      var targetY = itemBounds.y;
      var pointerHeight = Math.max(markerSize, targetY - pointerY);

      return {
        x: pointerX,
        y: pointerY,
        width: markerSize,
        height: pointerHeight,
        side: side,
      };
    }

    if (side === 'bottom') {
      var pointerX2 = itemCenterX - markerSize / 2;
      var pointerY2 = itemBounds.y + itemBounds.height;
      var markerY = alignmentLines.bottomY;
      var pointerHeight2 = Math.max(markerSize, markerY + markerSize - pointerY2);

      return {
        x: pointerX2,
        y: pointerY2,
        width: markerSize,
        height: pointerHeight2,
        side: side,
      };
    }

    if (side === 'left') {
      var pointerX3 = alignmentLines.leftX;
      var pointerY3 = itemCenterY - markerSize / 2;
      var targetX = itemBounds.x;
      var pointerWidth = Math.max(markerSize, targetX - pointerX3);

      return {
        x: pointerX3,
        y: pointerY3,
        width: pointerWidth,
        height: markerSize,
        side: side,
      };
    }

    if (side === 'right') {
      var pointerX4 = itemBounds.x + itemBounds.width;
      var pointerY4 = itemCenterY - markerSize / 2;
      var markerX = alignmentLines.rightX;
      var pointerWidth2 = Math.max(markerSize, markerX + markerSize - pointerX4);

      return {
        x: pointerX4,
        y: pointerY4,
        width: pointerWidth2,
        height: markerSize,
        side: side,
      };
    }

    return {
      x: itemCenterX,
      y: itemCenterY,
      width: markerSize,
      height: markerSize,
      side: side,
    };
  }

  function createConnectorForSide(index, side, options) {
    var thickness =
      options.connectorThickness != null
        ? options.connectorThickness
        : ANATOMY_LAYOUT.connectorThickness;
    var color = options.connectorColor || hexToRgb('#FC8507');

    var connector = figma.createFrame();
    connector.name = 'Anatomy connector / ' + index;
    connector.layoutMode = 'NONE';
    connector.fills = [{ type: 'SOLID', color: color }];
    connector.strokes = [];
    connector.clipsContent = false;

    if (isVerticalPointerSide(side)) {
      connector.resize(Math.max(1, Math.round(thickness)), 1);
      try {
        connector.layoutGrow = 1;
      } catch (error) {
        console.warn('Cannot set layoutGrow for vertical anatomy connector', error);
      }
      try {
        connector.layoutAlign = 'CENTER';
      } catch (error) {
        console.warn('Cannot set layoutAlign for vertical anatomy connector', error);
      }
    } else if (isHorizontalPointerSide(side)) {
      connector.resize(1, Math.max(1, Math.round(thickness)));
      try {
        connector.layoutGrow = 1;
      } catch (error) {
        console.warn('Cannot set layoutGrow for horizontal anatomy connector', error);
      }
      try {
        connector.layoutAlign = 'CENTER';
      } catch (error) {
        console.warn('Cannot set layoutAlign for horizontal anatomy connector', error);
      }
    }

    return connector;
  }

  function createAnatomyPointer(index, side, geometry, options) {
    var marker = createMarker(index, options);
    var connector = createConnectorForSide(index, side, options);

    var pointer = figma.createFrame();
    pointer.name = 'Anatomy pointer / ' + index;
    pointer.fills = [];
    pointer.strokes = [];
    pointer.clipsContent = false;
    pointer.itemSpacing = 0;

    if (side === 'top' || side === 'bottom') {
      pointer.layoutMode = 'VERTICAL';
      pointer.primaryAxisSizingMode = 'FIXED';
      pointer.counterAxisSizingMode = 'FIXED';
      pointer.primaryAxisAlignItems = 'MIN';
      pointer.counterAxisAlignItems = 'CENTER';
    }

    if (side === 'left' || side === 'right') {
      pointer.layoutMode = 'HORIZONTAL';
      pointer.primaryAxisSizingMode = 'FIXED';
      pointer.counterAxisSizingMode = 'FIXED';
      pointer.primaryAxisAlignItems = 'MIN';
      pointer.counterAxisAlignItems = 'CENTER';
    }

    if (side === 'top') {
      pointer.appendChild(marker);
      pointer.appendChild(connector);
    } else if (side === 'bottom') {
      pointer.appendChild(connector);
      pointer.appendChild(marker);
    } else if (side === 'left') {
      pointer.appendChild(marker);
      pointer.appendChild(connector);
    } else if (side === 'right') {
      pointer.appendChild(connector);
      pointer.appendChild(marker);
    }

    pointer.x = geometry.x;
    pointer.y = geometry.y;
    pointer.resize(geometry.width, geometry.height);

    return pointer;
  }

  function createAnatomyText(content, opts) {
    var t = figma.createText();
    t.name = opts.name || 'Anatomy text';
    t.fontName = opts.fontName;
    t.fontSize = opts.fontSize;
    t.lineHeight = opts.lineHeight || { unit: 'PERCENT', value: 130 };
    t.fills = opts.fills || [{ type: 'SOLID', color: opts.color || opts.listTextColor }];

    if (opts.width != null && opts.width > 0) {
      t.textAutoResize = 'HEIGHT';
      t.resize(opts.width, t.height);
    } else {
      t.textAutoResize = 'WIDTH_AND_HEIGHT';
    }

    var str = content === undefined || content === null ? '' : String(content);
    t.characters = str.length === 0 ? ' ' : str;
    return t;
  }

  function createMarker(index, options) {
    var frame = figma.createFrame();
    frame.name = 'Anatomy marker / ' + index;
    frame.layoutMode = 'HORIZONTAL';
    frame.primaryAxisAlignItems = 'CENTER';
    frame.counterAxisAlignItems = 'CENTER';
    frame.primaryAxisSizingMode = 'FIXED';
    frame.counterAxisSizingMode = 'FIXED';
    frame.itemSpacing = 0;
    frame.paddingTop = 0;
    frame.paddingRight = 0;
    frame.paddingBottom = 0;
    frame.paddingLeft = 0;
    frame.resize(options.markerSize, options.markerSize);
    frame.cornerRadius = options.markerSize / 2;
    frame.fills = [
      { type: 'SOLID', color: options.markerColor || hexToRgb('#FC8507') },
    ];
    frame.strokes = [];
    frame.clipsContent = false;

    var label = createAnatomyText(String(index), {
      name: 'Anatomy marker label',
      fontName: options.fontBold,
      fontSize: 12,
      lineHeight: { unit: 'PERCENT', value: 130 },
      fills: [
        {
          type: 'SOLID',
          color: options.markerTextColor || { r: 1, g: 1, b: 1 },
        },
      ],
    });

    frame.appendChild(label);
    return frame;
  }

  function createSmallListMarker(index, options) {
    var frame = figma.createFrame();
    frame.name = 'Anatomy list marker / ' + index;
    frame.layoutMode = 'HORIZONTAL';
    frame.primaryAxisAlignItems = 'CENTER';
    frame.counterAxisAlignItems = 'CENTER';
    frame.primaryAxisSizingMode = 'FIXED';
    frame.counterAxisSizingMode = 'FIXED';
    frame.resize(20, 20);
    frame.cornerRadius = 10;
    frame.fills = [
      { type: 'SOLID', color: options.markerColor || hexToRgb('#FC8507') },
    ];
    frame.strokes = [];
    frame.clipsContent = false;

    var label = createAnatomyText(String(index), {
      name: 'Anatomy list marker label',
      fontName: options.fontBold,
      fontSize: 12,
      lineHeight: { unit: 'PERCENT', value: 130 },
      fills: [
        {
          type: 'SOLID',
          color: options.markerTextColor || { r: 1, g: 1, b: 1 },
        },
      ],
    });

    frame.appendChild(label);
    return frame;
  }

  function createAnatomyListRow(item, options) {
    var row = figma.createFrame();
    row.name = 'Anatomy list item / ' + item.index;
    row.layoutMode = 'HORIZONTAL';
    row.primaryAxisAlignItems = 'MIN';
    row.counterAxisAlignItems = 'CENTER';
    row.primaryAxisSizingMode = 'FIXED';
    row.counterAxisSizingMode = 'AUTO';
    row.itemSpacing = 4;
    row.fills = [];
    row.strokes = [];
    row.clipsContent = false;

    var listText = options.listTextColor || hexToRgb('#4E4E4E');

    var numberText = createAnatomyText(String(item.index), {
      name: 'Anatomy list item number',
      fontName: options.fontBold,
      fontSize: 14,
      lineHeight: { unit: 'PERCENT', value: 130 },
      fills: [{ type: 'SOLID', color: listText }],
    });

    var nameText = createAnatomyText('\u2014 ' + item.name, {
      name: 'Anatomy list item name',
      fontName: options.fontRegular,
      fontSize: 14,
      lineHeight: { unit: 'PERCENT', value: 130 },
      fills: [{ type: 'SOLID', color: listText }],
    });

    row.appendChild(numberText);
    row.appendChild(nameText);

    nameText.layoutGrow = 1;
    nameText.textAutoResize = 'HEIGHT';

    row.resize(options.listWidth, row.height);

    return row;
  }

  function createAnatomyList(items, options) {
    var list = figma.createFrame();
    list.name = 'Anatomy list';
    list.layoutMode = 'VERTICAL';
    list.itemSpacing = 12;
    list.fills = [];
    list.strokes = [];
    list.clipsContent = false;
    list.primaryAxisSizingMode = 'AUTO';
    list.counterAxisSizingMode = 'FIXED';
    list.resize(options.listWidth, 1);

    var ri;
    for (ri = 0; ri < items.length; ri++) {
      list.appendChild(createAnatomyListRow(items[ri], options));
    }

    var totalH = 0;
    var ch = list.children;
    var cj;
    for (cj = 0; cj < ch.length; cj++) {
      totalH += ch[cj].height || 0;
    }
    if (ch.length > 1) {
      totalH += list.itemSpacing * (ch.length - 1);
    }
    list.resize(options.listWidth, Math.max(1, Math.round(totalH)));

    return list;
  }

  function createAnatomyFrame(params) {
    var sourceNode = params && params.sourceNode;
    if (!sourceNode || typeof sourceNode.clone !== 'function') {
      throw new Error('AnatomyGenerator.createAnatomyFrame: sourceNode must be cloneable.');
    }

    var title =
      params && params.title != null && params.title !== ''
        ? String(params.title)
        : 'Анатомия компонента';

    var merged = mergeOptions(params && params.options);

    var rootClone = sourceNode.clone();
    rootClone.name = 'Anatomy preview / ' + String(sourceNode.name);

    var sc = merged.scale;
    if (typeof sc === 'number' && !isNaN(sc) && sc > 0 && sc !== 1 && typeof rootClone.rescale === 'function') {
      rootClone.rescale(sc);
    }

    var items = collectSemanticAnatomyItems(rootClone, merged);

    var fp = merged.framePadding;
    var listGap = merged.listGap;

    var cw = rootClone.width;
    var ch = rootClone.height;

    var markerSize =
      merged.markerSize != null ? merged.markerSize : ANATOMY_LAYOUT.markerSize;
    var markerOffset =
      merged.markerOffset != null ? merged.markerOffset : ANATOMY_LAYOUT.markerOffset;
    var markerSafeArea = markerSize + markerOffset + 8;

    var previewGroup = figma.createFrame();
    previewGroup.name = 'Anatomy preview group';
    previewGroup.layoutMode = 'NONE';
    previewGroup.fills = [];
    previewGroup.strokes = [];
    previewGroup.clipsContent = false;
    previewGroup.resize(
      Math.max(1, Math.round(cw + markerSafeArea * 2)),
      Math.max(1, Math.round(ch + markerSafeArea * 2))
    );

    rootClone.x = markerSafeArea;
    rootClone.y = markerSafeArea;
    previewGroup.appendChild(rootClone);

    var rootBoundsRelative = { x: 0, y: 0, width: cw, height: ch };
    var rootBoundsInPreviewGroup = {
      x: rootClone.x,
      y: rootClone.y,
      width: rootClone.width,
      height: rootClone.height,
    };

    var alignmentLines = getPointerAlignmentLines(rootBoundsInPreviewGroup, merged);

    var pointerDataList = items.map(function (item) {
      var side = getItemAnchorSide(item.bounds, rootBoundsRelative);

      var itemBoundsInPreviewGroup = {
        x: rootClone.x + item.bounds.x,
        y: rootClone.y + item.bounds.y,
        width: item.bounds.width,
        height: item.bounds.height,
      };

      return {
        item: item,
        side: side,
        itemBounds: itemBoundsInPreviewGroup,
      };
    });

    var pi;
    for (pi = 0; pi < pointerDataList.length; pi++) {
      var pointerData = pointerDataList[pi];
      var geometry = getPointerGeometry(
        pointerData,
        rootBoundsInPreviewGroup,
        alignmentLines,
        merged
      );
      var pointer = createAnatomyPointer(
        pointerData.item.index,
        pointerData.side,
        geometry,
        merged
      );
      previewGroup.appendChild(pointer);
    }

    var list = createAnatomyList(items, merged);

    var anatomyFrame = figma.createFrame();
    anatomyFrame.name = title;
    anatomyFrame.layoutMode = 'NONE';
    anatomyFrame.clipsContent = false;

    var bg =
      merged.backgroundColor != null
        ? merged.backgroundColor
        : merged.frameFillColor || hexToRgb('#F7F7F7');
    anatomyFrame.fills = [{ type: 'SOLID', color: bg }];
    anatomyFrame.strokes = [];
    anatomyFrame.itemSpacing = 0;
    anatomyFrame.paddingTop = 0;
    anatomyFrame.paddingRight = 0;
    anatomyFrame.paddingBottom = 0;
    anatomyFrame.paddingLeft = 0;

    previewGroup.x = fp;
    previewGroup.y = fp;
    anatomyFrame.appendChild(previewGroup);

    list.x = fp + markerSafeArea + cw + listGap;
    list.y = fp;
    anatomyFrame.appendChild(list);

    var listH = list.height;
    var contentRight = Math.max(fp + previewGroup.width, list.x + list.width);
    var fw = contentRight + fp;
    var fh = fp + Math.max(previewGroup.height, listH) + fp;

    anatomyFrame.resize(Math.max(1, Math.round(fw)), Math.max(1, Math.round(fh)));

    return anatomyFrame;
  }

  async function loadFonts(options) {
    var merged = mergeOptions(options || {});

    try {
      await Promise.all([
        figma.loadFontAsync(merged.fontRegular),
        figma.loadFontAsync(merged.fontBold),
      ]);
    } catch (error) {
      console.warn('Cannot load anatomy fonts, trying Inter.', error);

      merged.fontRegular = { family: 'Inter', style: 'Regular' };
      merged.fontBold = { family: 'Inter', style: 'Bold' };

      await Promise.all([
        figma.loadFontAsync(merged.fontRegular),
        figma.loadFontAsync(merged.fontBold),
      ]);
    }

    return merged;
  }

  return {
    loadFonts: loadFonts,
    createAnatomyFrame: createAnatomyFrame,
    collectAnatomyItems: collectAnatomyItems,
    collectSemanticAnatomyItems: collectSemanticAnatomyItems,
    getComponentPropertyMetadata: getComponentPropertyMetadata,
  };
})();
