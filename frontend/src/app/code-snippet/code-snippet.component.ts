/*
 * Copyright (c) 2014-2021 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { CodeSnippetService, CodeSnippet } from '../Services/code-snippet.service'
import { CodeFixesService, Fixes } from '../Services/code-fixes.service'
import { CookieService } from 'ngx-cookie'
import { ChallengeService } from '../Services/challenge.service'
import { VulnLinesService, result } from '../Services/vuln-lines.service'
import { Component, Inject, OnInit } from '@angular/core'

import { MAT_DIALOG_DATA } from '@angular/material/dialog'
import { FormControl } from '@angular/forms'

enum ResultState {
  Undecided,
  Right,
  Wrong,
}

interface Solved {
  findIt: boolean
  fixIt: boolean
}

@Component({
  selector: 'app-user-details',
  templateUrl: './code-snippet.component.html',
  styleUrls: ['./code-snippet.component.scss']
})
export class CodeSnippetComponent implements OnInit {
  public snippet: CodeSnippet = null
  public fixes: Fixes = null
  public selectedLines: number[]
  public selectedFix: number
  public tab: FormControl = new FormControl(0)
  public lock: ResultState = ResultState.Undecided
  public result: ResultState = ResultState.Undecided
  public solved: Solved = { findIt: false, fixIt: false }

  constructor (@Inject(MAT_DIALOG_DATA) public dialogData: any, private readonly codeSnippetService: CodeSnippetService, private readonly vulnLinesService: VulnLinesService, private readonly codeFixesService: CodeFixesService, private readonly challengeService: ChallengeService, private readonly cookieService: CookieService) { }

  ngOnInit () {
    this.codeSnippetService.get(this.dialogData.key).subscribe((snippet) => {
      this.snippet = snippet
      this.solved.findIt = false
      if (this.dialogData.codingChallengeStatus >= 1) {
        this.result = ResultState.Right
        this.lock = ResultState.Right
        this.solved.findIt = true
      }
    }, (err) => {
      this.snippet = { snippet: JSON.stringify(err.error?.error) }
    })
    this.codeFixesService.get(this.dialogData.key).subscribe((fixes) => {
      this.fixes = fixes.fixes
      this.solved.fixIt = false
      if (this.dialogData.codingChallengeStatus >= 2) {
        this.solved.fixIt = true
      }
    }, () => {
      this.fixes = null
    })
  }

  addLine = (lines: number[]) => {
    this.selectedLines = lines
  }

  setFix = (fix: number) => {
    this.selectedFix = fix
  }

  toggleTab = (event: number) => {
    this.tab.setValue(event)
    this.result = ResultState.Undecided
    if (event === 0) {
      if (this.solved.findIt) this.result = ResultState.Right
    }
    if (event === 1) {
      if (this.solved.fixIt) this.result = ResultState.Right
    }
  }

  checkFix = () => {
    this.codeFixesService.check(this.dialogData.key, this.selectedFix).subscribe((verdict) => {
      this.setVerdict(verdict.verdict)
    })
  }

  checkLines = () => {
    this.vulnLinesService.check(this.dialogData.key, this.selectedLines).subscribe((verdict: result) => {
      this.setVerdict(verdict.verdict)
    })
  }

  lockIcon (): string {
    if (this.fixes === null) {
      return 'lock'
    }
    switch (this.lock) {
      case ResultState.Right:
        return 'lock_open'
      case ResultState.Wrong:
        return 'lock'
      case ResultState.Undecided:
        return 'lock'
    }
  }

  lockColor (): string {
    switch (this.lockIcon()) {
      case 'lock_open':
        return 'accent'
      case 'lock':
        return 'warn'
    }
  }

  setVerdict = (verdict: boolean) => {
    if (this.result === ResultState.Right) return
    if (verdict) {
      if (this.tab.value === 0) {
        this.solved.findIt = true
        this.challengeService.continueCodeFindIt().subscribe((continueCode) => {
          if (!continueCode) {
            throw (new Error('Received invalid continue code from the sever!'))
          }
          const expires = new Date()
          expires.setFullYear(expires.getFullYear() + 1)
          console.log(continueCode)
          this.cookieService.put('continueCodeFindIt', continueCode, { expires })
        }, (err) => console.log(err))
      } else {
        this.solved.fixIt = true
        this.challengeService.continueCodeFixIt().subscribe((continueCode) => {
          if (!continueCode) {
            throw (new Error('Received invalid continue code from the sever!'))
          }
          const expires = new Date()
          expires.setFullYear(expires.getFullYear() + 1)
          console.log(continueCode)
          this.cookieService.put('continueCodeFixIt', continueCode, { expires })
        }, (err) => console.log(err))
      }
      this.result = ResultState.Right
      this.lock = ResultState.Right
      import('../../confetti').then(module => {
        module.shootConfetti()
      })
        .then(() => {
          if (this.tab.value === 0 && this.fixes !== null) this.toggleTab(1)
        })
    } else {
      this.result = ResultState.Wrong
      this.lock = ResultState.Wrong
    }
  }

  resultIcon (): string {
    switch (this.result) {
      case ResultState.Right:
        return 'check'
      case ResultState.Wrong:
        return 'clear'
      default:
        return 'send'
    }
  }

  resultColor (): string {
    switch (this.resultIcon()) {
      case 'check':
        return 'accent'
      case 'clear':
        return 'warn'
    }
  }
}
