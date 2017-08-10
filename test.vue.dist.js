_c('Program', {}, [
  _c(
    'view',
    [
      _c('view', [
        _v(
          ' ' +
            _s({
              type: 'Program',
              start: 0,
              end: 7,
              body: [
                {
                  type: 'ExpressionStatement',
                  start: 0,
                  end: 7,
                  expression: {
                    type: 'Identifier',
                    start: 0,
                    end: 7,
                    name: 'message'
                  }
                }
              ],
              sourceType: 'script'
            }) +
            ' '
        )
      ]),
      _v(' '),
      _c('view', {
        attrs: {
          id:
            'item-' +
            _s({
              type: 'Program',
              start: 0,
              end: 2,
              body: [
                {
                  type: 'ExpressionStatement',
                  start: 0,
                  end: 2,
                  expression: {
                    type: 'Identifier',
                    start: 0,
                    end: 2,
                    name: 'id'
                  }
                }
              ],
              sourceType: 'script'
            })
        }
      }),
      _v(' '),
      condition ? _c('view') : _e(),
      _v(' '),
      _c('checkbox', {
        attrs: {
          checked: _s({
            type: 'Program',
            start: 0,
            end: 5,
            body: [
              {
                type: 'ExpressionStatement',
                start: 0,
                end: 5,
                expression: {
                  type: 'Literal',
                  start: 0,
                  end: 5,
                  value: false,
                  raw: 'false'
                }
              }
            ],
            sourceType: 'script'
          })
        }
      })
    ],
    1
  ),
  _c('view', [
    _c(
      'view',
      {
        attrs: {
          hidden: _s({
            type: 'Program',
            start: 0,
            end: 19,
            body: [
              {
                type: 'ExpressionStatement',
                start: 0,
                end: 19,
                expression: {
                  type: 'ConditionalExpression',
                  start: 0,
                  end: 19,
                  test: { type: 'Identifier', start: 0, end: 4, name: 'flag' },
                  consequent: {
                    type: 'Literal',
                    start: 7,
                    end: 11,
                    value: true,
                    raw: 'true'
                  },
                  alternate: {
                    type: 'Literal',
                    start: 14,
                    end: 19,
                    value: false,
                    raw: 'false'
                  }
                }
              }
            ],
            sourceType: 'script'
          })
        }
      },
      [_v(' Hidden ')]
    ),
    _v(' '),
    _c('view', [
      _v(
        ' ' +
          _s({
            type: 'Program',
            start: 0,
            end: 5,
            body: [
              {
                type: 'ExpressionStatement',
                start: 0,
                end: 5,
                expression: {
                  type: 'BinaryExpression',
                  start: 0,
                  end: 5,
                  left: { type: 'Identifier', start: 0, end: 1, name: 'a' },
                  operator: '+',
                  right: { type: 'Identifier', start: 4, end: 5, name: 'b' }
                }
              }
            ],
            sourceType: 'script'
          }) +
          ' + ' +
          _s({
            type: 'Program',
            start: 0,
            end: 1,
            body: [
              {
                type: 'ExpressionStatement',
                start: 0,
                end: 1,
                expression: { type: 'Identifier', start: 0, end: 1, name: 'c' }
              }
            ],
            sourceType: 'script'
          }) +
          ' + d '
      )
    ]),
    _v(' '),
    length > 5 ? _c('view') : _e(),
    _v(' '),
    _c('view', [
      _v(
        _s({
          type: 'Program',
          start: 0,
          end: 14,
          body: [
            {
              type: 'ExpressionStatement',
              start: 0,
              end: 14,
              expression: {
                type: 'BinaryExpression',
                start: 0,
                end: 14,
                left: {
                  type: 'Literal',
                  start: 0,
                  end: 7,
                  value: 'hello',
                  raw: '"hello"'
                },
                operator: '+',
                right: { type: 'Identifier', start: 10, end: 14, name: 'name' }
              }
            }
          ],
          sourceType: 'script'
        })
      )
    ]),
    _v(' '),
    _c('view', [
      _v(
        _s({
          type: 'Program',
          start: 0,
          end: 10,
          body: [
            {
              type: 'ExpressionStatement',
              start: 0,
              end: 10,
              expression: {
                type: 'MemberExpression',
                start: 0,
                end: 10,
                object: {
                  type: 'Identifier',
                  start: 0,
                  end: 6,
                  name: 'object'
                },
                property: {
                  type: 'Identifier',
                  start: 7,
                  end: 10,
                  name: 'key'
                },
                computed: false
              }
            }
          ],
          sourceType: 'script'
        }) +
          ' ' +
          _s({
            type: 'Program',
            start: 0,
            end: 8,
            body: [
              {
                type: 'ExpressionStatement',
                start: 0,
                end: 8,
                expression: {
                  type: 'MemberExpression',
                  start: 0,
                  end: 8,
                  object: {
                    type: 'Identifier',
                    start: 0,
                    end: 5,
                    name: 'array'
                  },
                  property: {
                    type: 'Literal',
                    start: 6,
                    end: 7,
                    value: 0,
                    raw: '0'
                  },
                  computed: true
                }
              }
            ],
            sourceType: 'script'
          })
      )
    ])
  ]),
  _c(
    'view',
    [
      _l([zero, 1, 2, 3, 4], function(item, index) {
        return _c('view', [
          _v(
            ' ' +
              _s({
                type: 'Program',
                start: 0,
                end: 4,
                body: [
                  {
                    type: 'ExpressionStatement',
                    start: 0,
                    end: 4,
                    expression: {
                      type: 'Identifier',
                      start: 0,
                      end: 4,
                      name: 'item'
                    }
                  }
                ],
                sourceType: 'script'
              }) +
              ' '
          )
        ])
      }),
      _v(' '),
      void 0
    ],
    2
  )
])
