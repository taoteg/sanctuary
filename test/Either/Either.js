'use strict';

var jsc = require('jsverify');
var R = require('ramda');

var S = require('../..');


//  Identity :: a -> Identity a
function Identity(x) {
  return {
    of: Identity,
    map: function(fn) {
      return Identity(fn(x));
    },
    ap: function(y) {
      return Identity(x(y));
    },
    equals: function(other) {
      return R.equals(x, other.value);
    },
    value: x
  };
}

Identity.of = Identity;

//  IdentityArb :: Arbitrary a -> Arbitrary (Identity a)
function IdentityArb(arb) {
  return arb.smap(Identity, function(i) { return i.value; });
}

//  identityToMaybe :: Identity a -> Maybe a
function identityToMaybe(i) {
  return S.Just(i.value);
}

//  EitherArb :: Arbitrary a -> Arbitrary b -> Arbitrary (Either a b)
function EitherArb(lArb, rArb) {
  return jsc.oneof(LeftArb(lArb), RightArb(rArb));
}

//  LeftArb :: Arbitrary a -> Arbitrary (Either a b)
function LeftArb(arb) {
  return arb.smap(S.Left, function(e) { return e.value; }, R.toString);
}

//  RightArb :: Arbitrary a -> Arbitrary (Either b a)
function RightArb(arb) {
  return arb.smap(S.Right, function(e) { return e.value; }, R.toString);
}

//  Compose :: Apply f, Apply g
//          => { of: b -> f b } -> { of: c -> g c }
//          -> f (g a) -> Compose f g a
function Compose(F, G) {
  function _Compose(x) {
    return {
      constructor: _Compose,
      map: function(f) {
        return _Compose(R.map(R.map(f), x));
      },
      ap: function(y) {
        return _Compose(R.ap(R.map(R.ap, x), y.value));
      },
      equals: function(other) {
        return R.equals(x, other.value);
      },
      value: x
    };
  }
  _Compose.of = function(x) {
    return _Compose(F.of(G.of(x)));
  };
  return _Compose;
}

suite('Either', function() {

  suite('Traversable laws', function() {

    test('satisfies naturality', function() {
      jsc.assert(jsc.forall(EitherArb(jsc.integer, IdentityArb(jsc.string)), function(either) {
        var lhs = identityToMaybe(either.sequence(Identity.of));
        var rhs = either.map(identityToMaybe).sequence(S.Maybe.of);
        return lhs.equals(rhs);
      }));
    });

    test('satisfies identity', function() {
      jsc.assert(jsc.forall(EitherArb(jsc.integer, jsc.string), function(either) {
        var lhs = either.map(Identity).sequence(Identity.of);
        var rhs = Identity.of(either);
        return lhs.equals(rhs);
      }));
    });

    test('satisfies composition', function() {
      jsc.assert(jsc.forall(EitherArb(jsc.string, IdentityArb(EitherArb(jsc.string, jsc.integer))), function(u) {
        var C = Compose(Identity, S.Either);
        var lhs = u.map(C).sequence(C.of);
        var rhs = C(u.sequence(Identity.of).map(function(x) {
          return x.sequence(S.Either.of);
        }));
        return lhs.equals(rhs);
      }));
    });

  });

});
