/*
Copyright (C) 2020 marc2003
Usage: node scintilla_iface.js
*/

'use strict'

const filenames = {
	'input': 'Scintilla.iface',
	'output': '../../src/ui/ScintillaImpl.h',
}

const options = 'utf8'
const newline = '\r\n'

const types = {
	'bool': 'bool',
	'cells': 'const char*',
	'colour': 'Colour',
	'findtext': 'void*',
	'formatrange': 'void*',
	'line': 'Line',
	'pointer': 'void*',
	'position': 'Position',
	'string': 'const char*',
	'stringresult': 'char*',
	'textrange': 'void*',
	'void' : 'void',
}

const header =
`#pragma once
#include <ILexer.h>
#include <Lexilla.h>
#include <Scintilla.h>
#include <SciLexer.h>

template <class T>
class CScintillaImpl : public CWindowImpl<T, CWindow, CControlWinTraits>
{
public:
	DECLARE_WND_SUPERCLASS2(L"WTL_ScintillaCtrl", CScintillaImpl, CWindow::GetWndClassName())

	using Colour = int;
	using Line = int;
	using Position = int;

	void SetFnPtr()
	{
		ATLASSERT(::IsWindow(this->m_hWnd));
		fn = reinterpret_cast<FunctionDirect>(::SendMessage(this->m_hWnd, SCI_GETDIRECTFUNCTION, 0, 0));
		ptr = ::SendMessage(this->m_hWnd, SCI_GETDIRECTPOINTER, 0, 0);
	}

	// Auto-generated from Scintilla.iface by scintilla_iface.js`.split('\n')
	
const footer =
`
private:
	using FunctionDirect = intptr_t(*)(intptr_t ptr, uint32_t msg, uintptr_t wParam, intptr_t lParam);

	intptr_t Call(uint32_t msg, uintptr_t wParam = 0, intptr_t lParam = 0)
	{
		return fn(ptr, msg, wParam, lParam);
	}

	FunctionDirect fn;
	intptr_t ptr;
};
`.split('\n')

function format_wp(type, name) {
	if (!name.length) return '0'
	if (type.endsWith('*')) return `reinterpret_cast<uintptr_t>(${name})`
	return name
}

function format_lp(type, name) {
	if (!name.length) return '0'
	if (type.endsWith('*')) return `reinterpret_cast<intptr_t>(${name})`
	if (type == 'int' || type == 'bool' || type == 'Colour' || type == 'Line' || type == 'Position') return name
	console.log(`Parsing aborted because of unknown type: ${type} ${name}`)
	process.exit(1)
}

function get_args(line) {
	const start = line.indexOf('(')
	const end = line.indexOf(')')
	return line.substr(start + 1, end - start - 1).split(',').map(item => item.trim().split(' '))
}

function get_type(type) {
	if (!type) return ''
	return types[type] || 'int'
}

function create_body(content) {
	const lines = content.split(newline)
	const features = ['fun', 'get', 'set']
	let tmp = []

	for (const line of lines) {
		if (line.startsWith('cat Deprecated')) break

		const str = line.substr(0, line.indexOf('=')).split(' ')
		const feature = str[0]

		if (features.includes(feature)) {
			const ret = get_type(str[1])
			const name = str[2]

			const [wp, lp] = get_args(line)
			const typeWp = get_type(wp[0])
			const nameWp = wp[1] || ''
			const typeLp = get_type(lp[0])
			const nameLp = lp[1] || ''

			let main = `\t${ret} ${name}(`
			if (typeWp.length) main += `${typeWp} ${nameWp}`
			if (typeWp.length && typeLp.length) main += ', '
			if (typeLp.length) main += `${typeLp} ${nameLp}`
			main += ') { '

			if (ret != 'void') main += 'return '

			let cast = false
			if (ret == 'void*') {
				cast = true
				main += 'reinterpret_cast<void*>('
			}

			main += `Call(SCI_${name.toUpperCase()}`

			if (typeWp.length || typeLp.length) {
				main += `, ${format_wp(typeWp, nameWp)}`
				if (typeLp.length) {
					main += `, ${format_lp(typeLp, nameLp)}`
				}
			}

			if (cast) main += ')'
			main += '); }'

			tmp.push(main)
		}
	}
	tmp.sort()
	return tmp
}

const fs = require('fs')
const path = require('path')

fs.readFile(path.join(__dirname, filenames.input), options, (err, content) => {
	if (err) {
		console.log(err)
		process.exit(1)
	}

	const out = [...header, ...create_body(content), ...footer].join(newline);

	fs.writeFile(path.join(__dirname, filenames.output), out, options, (err) => {
		if (err) {
			console.log(err)
			process.exit(1)
		}
		console.log('Done!')
	})
})
