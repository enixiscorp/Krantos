const fs = require('fs');
const p = '.kiro/specs/vendor-commission-contracts/design.md';
const bt = String.fromCharCode(96);
const arr = '\u2192';
const x = '\u00d7';
const chk = '\u2705';
const crs = '\u274c';
const sig = '\u03a3';
function bts(s) { return bt+s+bt; }
function bt3() { return bt+bt+bt; }

const doc = [
'# Design Document : Gestion des Commissions, Contrats et Facturation Vendeurs',
'',
"## Vue d\u2019ensemble",
'',
"Cette fonctionnalit\u00e9 \u00e9tend la plateforme Krantos avec un syst\u00e8me complet de gestion des commissions, des contrats vendeurs et de la facturation. Elle permet \u00e0 l\u2019\u00e9quipe administrative de d\u00e9finir des taux de commission par vendeur, de g\u00e9rer le cycle de vie des contrats (activation, expiration, renouvellement), de d\u00e9tecter les tentatives de fraude, et de g\u00e9n\u00e9rer des rapports de facturation p\u00e9riodiques.",
'',
"Le syst\u00e8me s\u2019appuie sur les tables existantes (" + bts('vendors') + ", " + bts('products') + ", " + bts('leads') + ") et y ajoute de nouvelles entit\u00e9s\u00a0: " + bts('vendor_contracts') + ", " + bts('commissions') + ", " + bts('billing_reports') + " et " + bts('fraud_attempts') + ". L\u2019acc\u00e8s est contr\u00f4l\u00e9 par deux niveaux de r\u00f4les administratifs\u00a0: Super Administrateur et Administrateur collaborateur.",
'',
'---',
'',
].join('\n');

fs.writeFileSync(p, doc, 'utf8');
console.log('done');