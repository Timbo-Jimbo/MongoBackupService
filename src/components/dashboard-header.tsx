"use client"
import { LogoutButton } from "@app/login/components";
import { Button } from "@comp/button";
import { Dialog, DialogContent, DialogTitle } from "@comp/dialog";
import { Separator } from "@comp/separator";
import { cn } from "@lib/utils";
import Image from "next/image";
import { useState } from "react";
import ReactMarkdown from 'react-markdown'

var changelogMdFile = require('@app/../CHANGELOG.md');

export function DashboardHeader () {

    const [ isChangeLogOpen, setIsChangeLogOpen ] = useState(false);
    return (
        <div className="sticky top-0 z-50 backdrop-blur-md shadow-lg pb-[2px] bg-gradient-to-r from-emerald-500/10 to-slate-800/40">
            <div className="bg-black/50 flex items-center justify-between p-4">
                <div className="flex items-center space-x-4">
                    <Image src="/logo.svg" alt="MongoDB Logo" width={32} height={32} />
                    <div className="text-xl font-bold hidden sm:inline-flex">Mongo Backup Service</div>
                    <Button onClick={() => setIsChangeLogOpen(true)} variant={"ghost"} className="text-muted-foreground hidden sm:inline-flex">
                        v0.1.2
                    </Button>
                </div>
                <LogoutButton />
            </div>
            <Dialog open={isChangeLogOpen} onOpenChange={setIsChangeLogOpen}>
                <DialogContent>
                    <DialogTitle>Changelog</DialogTitle>
                    <div className={cn([
                        "[&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h4]:text-sm [&_h5]:text-xs [&_h6]:text-xs",
                        "[&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_h4]:font-bold [&_h5]:font-bold [&_h6]:font-bold",
                        "[&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4 [&_li]:mt-2 [&_ul]:mb-4",
                        "flex flex-col gap-2 p-4"
                    ])}>
                        <ReactMarkdown
                            components={{
                                hr: () => (<Separator className="my-4" />)
                            }}
                        >
                            {changelogMdFile.default}
                        </ReactMarkdown>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}