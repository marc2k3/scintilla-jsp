/*
Copyright (C) 2020 marc2003
Generates ScintillaImpl.h from Scintilla.iface

Usage: node ScintillaImpl.mjs
*/

'use strict'

import { join, dirname } from 'path'
import { readFile, writeFile } from 'fs'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const filenames = {
	'input': join(__dirname, 'Scintilla.iface'),
	'output': join(__dirname, 'ScintillaImpl.h'),
}

const options = 'utf8'
const CRLF = '\r\n'

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
	DECLARE_WND_SUPERCLASS2(L"CScintillaImpl", CScintillaImpl, CWindow::GetWndClassName())

	using Colour = int;
	using Line = int;
	using Position = int;

	void SetFnPtr()
	{
		ATLASSERT(::IsWindow(this->m_hWnd));
		fn = reinterpret_cast<SciFnDirect>(::SendMessage(this->m_hWnd, SCI_GETDIRECTFUNCTION, 0, 0));
		ptr = ::SendMessage(this->m_hWnd, SCI_GETDIRECTPOINTER, 0, 0);
	}
`.split('\n')

const footer =
`
private:
	intptr_t Call(uint32_t msg, uintptr_t wParam = 0, intptr_t lParam = 0)
	{
		return fn(ptr, msg, wParam, lParam);
	}

	SciFnDirect fn;
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
	const allowed = ['int', 'bool', 'Colour', 'Line', 'Position']
	if (allowed.includes(type)) return name
	exit(`Parsing aborted because of unknown type: ${type} ${name}`)
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
	const lines = content.split(CRLF)
	const features = ['fun', 'get', 'set']
	let tmp = []

	for (const line of lines) {
		if (line.startsWith('cat Deprecated')) break

		const arr = line.substr(0, line.indexOf('=')).split(' ')
		const feature = arr[0]

		if (features.includes(feature)) {
			const ret = get_type(arr[1])
			const name = arr[2]

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

function exit(message) {
	console.log(message)
	process.exit(1)
}

readFile(filenames.input, options, (err, content) => {
	if (err) exit(err)

	const out = [...header, ...create_body(content), ...footer].join(CRLF)

	writeFile(filenames.output, out, options, (err) => {
		if (err) exit(err)
		console.log('Done!')
	})
})
